/**
 * BE-RAG-002: 创建知识库相关表
 * 艹，这个SB migration创建KB元数据表和chunks表！
 */

exports.up = async function (knex) {
  const hasDocuments = await knex.schema.hasTable('kb_documents');
  const hasChunks = await knex.schema.hasTable('kb_chunks');

  if (!hasDocuments) {
    await knex.schema.createTable('kb_documents', (table) => {
      table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
      table.string('user_id', 32).notNullable().comment('用户ID');
      table.string('kb_id', 32).notNullable().comment('知识库ID');
      table.string('title', 255).notNullable().comment('文档标题');
      table.text('content').comment('原始内容');
      table.string('format', 20).notNullable().comment('文档格式: markdown/html/pdf');
      table.integer('file_size').unsigned().comment('文件大小(字节)');
      table.string('source_url', 500).nullable().comment('来源URL');
      table
        .enum('status', ['pending', 'processing', 'completed', 'failed'])
        .notNullable()
        .defaultTo('pending')
        .comment('处理状态');
      table.text('error_message').nullable().comment('错误信息');
      table.integer('chunk_count').unsigned().defaultTo(0).comment('切块数量');
      table.timestamps(true, true);

      // 索引
      table.index('user_id', 'idx_kb_documents_user');
      table.index('kb_id', 'idx_kb_documents_kb');
      table.index('status', 'idx_kb_documents_status');
      table.index(['user_id', 'kb_id'], 'idx_kb_documents_user_kb');
    });
  }

  if (!hasChunks) {
    await knex.schema.createTable('kb_chunks', (table) => {
      table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
      table.string('document_id', 36).notNullable().comment('文档ID');
      table.integer('chunk_index').unsigned().notNullable().comment('块索引');
      table.text('text').notNullable().comment('块内容');
      table.integer('start_pos').unsigned().comment('起始位置');
      table.integer('end_pos').unsigned().comment('结束位置');
      table.integer('length').unsigned().comment('块长度');
      table.string('embedding_vector_id', 100).nullable().comment('向量ID');
      table
        .enum('embedding_status', ['pending', 'completed', 'failed'])
        .defaultTo('pending')
        .comment('向量化状态');
      table.json('metadata').comment('元数据');
      table.timestamps(true, true);

      // 索引
      table.index('document_id', 'idx_kb_chunks_document');
      table.index('embedding_status', 'idx_kb_chunks_embedding_status');
      table.index(['document_id', 'chunk_index'], 'idx_kb_chunks_doc_index');

      // 外键
      table.foreign('document_id').references('id').inTable('kb_documents').onDelete('CASCADE');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('kb_chunks');
  await knex.schema.dropTableIfExists('kb_documents');
};
