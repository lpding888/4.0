/**
 * 文件下载工具
 * 支持从HTTP/HTTPS URL下载文件到本地
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const logger = require('./logger');

const pipeline = promisify(stream.pipeline);

/**
 * 下载单个文件
 * @param {string} url - 文件URL
 * @param {string} localPath - 本地保存路径
 * @returns {Promise<string>} 本地文件路径
 */
async function downloadFile(url, localPath) {
  try {
    logger.info('开始下载文件', { url, localPath });

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000 // 60秒超时
    });

    // 确保目录存在
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 流式写入文件
    await pipeline(
      response.data,
      fs.createWriteStream(localPath)
    );

    logger.info('文件下载完成', { url, localPath });
    return localPath;

  } catch (error) {
    logger.error('文件下载失败', { url, error: error.message });
    throw new Error(`文件下载失败: ${url} - ${error.message}`);
  }
}

/**
 * 批量下载文件
 * @param {Array<string>} urls - 文件URL列表
 * @param {string} tmpDir - 临时目录
 * @returns {Promise<Array<string>>} 本地文件路径列表
 */
async function downloadFiles(urls, tmpDir = '/tmp') {
  const tasks = urls.map((url, index) => {
    const ext = path.extname(url) || '.tmp';
    const filename = `file_${index}${ext}`;
    const localPath = path.join(tmpDir, filename);
    return downloadFile(url, localPath);
  });

  return await Promise.all(tasks);
}

/**
 * 清理临时文件
 * @param {Array<string>} filePaths - 文件路径列表
 */
async function cleanupFiles(filePaths) {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug('临时文件已删除', { filePath });
      }
    } catch (error) {
      logger.warn('临时文件删除失败', { filePath, error: error.message });
    }
  }
}

module.exports = {
  downloadFile,
  downloadFiles,
  cleanupFiles
};
