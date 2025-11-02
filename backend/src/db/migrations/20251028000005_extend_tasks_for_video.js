/**
 * Extend tasks table for video generation feature
 * Add video-specific fields: coverUrl and thumbnailUrl
 */
exports.up = async function(knex) {
  try {
    // Check if columns already exist to make migration idempotent
    const hasCoverUrl = await knex.schema.hasColumn('tasks', 'coverUrl');
    const hasThumbnailUrl = await knex.schema.hasColumn('tasks', 'thumbnailUrl');

    if (!hasCoverUrl || !hasThumbnailUrl) {
      await knex.schema.alterTable('tasks', function(table) {
        if (!hasCoverUrl) {
          table.string('coverUrl', 2048).nullable().comment('Video cover URL');
        }
        if (!hasThumbnailUrl) {
          table.string('thumbnailUrl', 2048).nullable().comment('Video thumbnail GIF URL');
        }
      });
      console.log('✓ Tasks table video fields extended successfully');
    } else {
      console.log('✓ Video fields already exist, skipping migration');
    }
  } catch (error) {
    console.error('✗ Failed to extend tasks table for video:', error);
    throw error;
  }
};

exports.down = async function(knex) {
  try {
    const hasCoverUrl = await knex.schema.hasColumn('tasks', 'coverUrl');
    const hasThumbnailUrl = await knex.schema.hasColumn('tasks', 'thumbnailUrl');

    if (hasCoverUrl || hasThumbnailUrl) {
      await knex.schema.alterTable('tasks', function(table) {
        if (hasCoverUrl) {
          table.dropColumn('coverUrl');
        }
        if (hasThumbnailUrl) {
          table.dropColumn('thumbnailUrl');
        }
      });
      console.log('✓ Tasks table video fields rollback successfully');
    } else {
      console.log('✓ Video fields do not exist, skipping rollback');
    }
  } catch (error) {
    console.error('✗ Failed to rollback tasks table video fields:', error);
    throw error;
  }
};