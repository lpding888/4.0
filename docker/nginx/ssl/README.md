# SSL证书目录

艹！把你的SSL证书放这里！

## 📁 需要的文件

- `fullchain.pem` - 完整证书链
- `privkey.pem` - 私钥文件

## 🔒 获取SSL证书

### 方法1: Let's Encrypt免费证书（推荐）

```bash
# 艹！安装certbot
sudo apt-get update
sudo apt-get install -y certbot

# 艹！申请证书
sudo certbot certonly --standalone -d aizhao.icu -d www.aizhao.icu

# 艹！证书位置
# /etc/letsencrypt/live/aizhao.icu/fullchain.pem
# /etc/letsencrypt/live/aizhao.icu/privkey.pem

# 艹！复制到这里
sudo cp /etc/letsencrypt/live/aizhao.icu/fullchain.pem ./
sudo cp /etc/letsencrypt/live/aizhao.icu/privkey.pem ./
sudo chmod 644 ./*.pem
```

### 方法2: 自签名证书（仅测试用）

```bash
# 艹！生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=CN/ST=Guangdong/L=Shenzhen/O=AI Photo/CN=aizhao.icu"
```

### 方法3: 云服务商申请

- **腾讯云**: SSL证书管理
- **阿里云**: 数字证书管理服务
- **CloudFlare**: SSL/TLS证书

下载证书后，重命名为 `fullchain.pem` 和 `privkey.pem`

## ⚠️ 重要提示

- **权限**: 证书文件权限应为 `644`
- **备份**: 定期备份证书文件
- **续期**: Let's Encrypt证书90天有效期，需定时续期
- **.gitignore**: 证书文件已添加到.gitignore，不会提交到Git

## 🔄 自动续期（Let's Encrypt）

```bash
# 艹！添加到crontab
sudo crontab -e

# 艹！每月1号凌晨2点自动续期
0 2 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/aizhao.icu/*.pem /path/to/project/docker/nginx/ssl/ && cd /path/to/project && docker-compose restart nginx
```

---

**证书配置完成后，记得启用HTTPS配置！**

编辑 `docker/nginx/conf.d/api.conf`，取消注释HTTPS部分。
