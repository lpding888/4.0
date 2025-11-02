# API对接指南 - 小程序和App

老王写的后端API对接指南，适用于微信小程序、原生App、uniApp等所有移动端。

## 🎯 后端兼容性说明

**✅ 本后端支持所有能发HTTP请求的客户端！**

- 微信小程序 (wx.request)
- 支付宝小程序 (my.request)
- 原生iOS App (URLSession/Alamofire)
- 原生Android App (OkHttp/Retrofit)
- uniApp (uni.request)
- Flutter (http/dio)
- React Native (fetch/axios)

---

## 📡 API基础信息

### 服务器地址

```javascript
// 开发环境
const API_BASE_URL = 'http://localhost:3000/api';

// 生产环境 (部署后替换)
const API_BASE_URL = 'https://your-domain.com/api';
```

### 响应格式

所有接口统一返回JSON格式：

```json
// 成功响应
{
  "success": true,
  "data": { /* 具体数据 */ }
}

// 失败响应
{
  "success": false,
  "error": {
    "code": 400,
    "message": "错误信息"
  }
}
```

---

## 🔐 认证流程

### 1. 用户登录/注册

**接口:** `POST /api/auth/wechat-login`

**微信小程序示例:**

```javascript
// 小程序端代码
async function wxLogin() {
  try {
    // 1. 获取微信登录code
    const { code } = await wx.login();

    // 2. 调用后端登录接口
    const res = await wx.request({
      url: 'http://localhost:3000/api/auth/wechat-login',
      method: 'POST',
      data: {
        code: code,
        userInfo: {
          nickName: '用户昵称',
          avatarUrl: '头像URL'
        }
      }
    });

    // 3. 保存token
    const { token, user } = res.data.data;
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', user);

    console.log('登录成功:', user);
    return token;

  } catch (error) {
    console.error('登录失败:', error);
    wx.showToast({ title: '登录失败', icon: 'none' });
  }
}
```

**uniApp示例:**

```javascript
// uniApp通用代码
async function login() {
  try {
    // 1. 获取登录code (支持微信/支付宝等)
    const [err, res] = await uni.login();

    // 2. 调用后端
    const response = await uni.request({
      url: 'http://localhost:3000/api/auth/wechat-login',
      method: 'POST',
      data: {
        code: res.code,
        userInfo: {
          nickName: '用户昵称',
          avatarUrl: '头像URL'
        }
      }
    });

    // 3. 保存token
    const { token, user } = response.data.data;
    uni.setStorageSync('token', token);
    uni.setStorageSync('userInfo', user);

    return token;

  } catch (error) {
    console.error('登录失败:', error);
  }
}
```

**原生App示例 (iOS Swift):**

```swift
// iOS原生代码
func login(code: String) {
    let url = URL(string: "http://localhost:3000/api/auth/wechat-login")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = [
        "code": code,
        "userInfo": [
            "nickName": "用户昵称",
            "avatarUrl": "头像URL"
        ]
    ] as [String : Any]

    request.httpBody = try? JSONSerialization.data(withJSONObject: body)

    URLSession.shared.dataTask(with: request) { data, response, error in
        guard let data = data else { return }

        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let dataObj = json["data"] as? [String: Any],
           let token = dataObj["token"] as? String {

            // 保存token
            UserDefaults.standard.set(token, forKey: "token")
            print("登录成功:", token)
        }
    }.resume()
}
```

### 2. 携带Token访问接口

**所有需要认证的接口都需要在请求头带上token:**

```javascript
// 微信小程序
wx.request({
  url: 'http://localhost:3000/api/features',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${wx.getStorageSync('token')}`
  },
  success: (res) => {
    console.log('功能列表:', res.data.data);
  }
});

// uniApp
uni.request({
  url: 'http://localhost:3000/api/features',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${uni.getStorageSync('token')}`
  },
  success: (res) => {
    console.log('功能列表:', res.data.data);
  }
});

// iOS Swift
var request = URLRequest(url: url)
request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
```

---

## 🎨 核心业务接口

### 1. 获取功能列表

**接口:** `GET /api/features`

**微信小程序:**

```javascript
async function getFeatures() {
  const res = await wx.request({
    url: 'http://localhost:3000/api/features',
    method: 'GET',
    header: {
      'Authorization': `Bearer ${wx.getStorageSync('token')}`
    }
  });

  const features = res.data.data.features;
  console.log('可用功能:', features);
  return features;
}
```

**响应示例:**

```json
{
  "success": true,
  "data": {
    "features": [
      {
        "id": "ai_model_12_pose",
        "name": "AI模特12分镜",
        "description": "生成12张不同角度的模特照片",
        "price": 10,
        "parameters": {
          "scene": ["street", "studio", "indoor"],
          "category": ["shoes", "dress", "hoodie"]
        }
      }
    ]
  }
}
```

### 2. 上传图片

**接口:** `POST /api/media/upload`

**微信小程序上传图片:**

```javascript
async function uploadImage() {
  try {
    // 1. 选择图片
    const { tempFilePaths } = await wx.chooseImage({
      count: 1,
      sizeType: ['compressed']
    });

    // 2. 上传到后端
    const uploadRes = await wx.uploadFile({
      url: 'http://localhost:3000/api/media/upload',
      filePath: tempFilePaths[0],
      name: 'file',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      }
    });

    // 3. 解析返回的图片URL
    const result = JSON.parse(uploadRes.data);
    const imageUrl = result.data.url;

    console.log('上传成功:', imageUrl);
    return imageUrl;

  } catch (error) {
    console.error('上传失败:', error);
    wx.showToast({ title: '上传失败', icon: 'none' });
  }
}
```

**uniApp上传图片:**

```javascript
async function uploadImage() {
  try {
    // 1. 选择图片
    const [err, res] = await uni.chooseImage({
      count: 1,
      sizeType: ['compressed']
    });

    // 2. 上传
    const uploadRes = await uni.uploadFile({
      url: 'http://localhost:3000/api/media/upload',
      filePath: res.tempFilePaths[0],
      name: 'file',
      header: {
        'Authorization': `Bearer ${uni.getStorageSync('token')}`
      }
    });

    const result = JSON.parse(uploadRes.data);
    return result.data.url;

  } catch (error) {
    console.error('上传失败:', error);
  }
}
```

### 3. 创建任务

**接口:** `POST /api/task/create-by-feature`

**微信小程序创建AI模特任务:**

```javascript
async function createAIModelTask(imageUrl) {
  try {
    const res = await wx.request({
      url: 'http://localhost:3000/api/task/create-by-feature',
      method: 'POST',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`,
        'Content-Type': 'application/json'
      },
      data: {
        featureId: 'ai_model_12_pose',
        inputImageUrl: imageUrl,
        params: {
          scene: 'street',        // 街拍/白棚/室内
          category: 'dress',      // 鞋子/连衣裙/卫衣
          productDescription: '夏季连衣裙'
        }
      }
    });

    const task = res.data.data;
    console.log('任务创建成功:', task.taskId);

    // 开始轮询任务状态
    pollTaskStatus(task.taskId);

    return task;

  } catch (error) {
    console.error('创建任务失败:', error);
    wx.showToast({ title: '创建失败', icon: 'none' });
  }
}
```

### 4. 查询任务状态

**接口:** `GET /api/task/:taskId`

**微信小程序轮询任务:**

```javascript
// 轮询任务状态
function pollTaskStatus(taskId) {
  const timer = setInterval(async () => {
    try {
      const res = await wx.request({
        url: `http://localhost:3000/api/task/${taskId}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      });

      const task = res.data.data;

      if (task.status === 'completed') {
        clearInterval(timer);
        console.log('任务完成! 结果:', task.outputUrl);

        // 显示结果
        wx.showModal({
          title: '生成成功',
          content: '12张模特照片已生成',
          success: () => {
            // 跳转到结果页
            wx.navigateTo({
              url: `/pages/result/result?taskId=${taskId}`
            });
          }
        });

      } else if (task.status === 'failed') {
        clearInterval(timer);
        console.error('任务失败:', task.error_message);
        wx.showToast({ title: '生成失败', icon: 'none' });
      } else {
        console.log('任务进行中...', task.status);
      }

    } catch (error) {
      console.error('查询失败:', error);
    }
  }, 3000); // 每3秒查询一次
}
```

### 5. 获取用户素材库

**接口:** `GET /api/assets?type=output`

```javascript
async function getMyAssets() {
  const res = await wx.request({
    url: 'http://localhost:3000/api/assets?type=output',
    method: 'GET',
    header: {
      'Authorization': `Bearer ${wx.getStorageSync('token')}`
    }
  });

  const assets = res.data.data.assets;
  console.log('我的作品:', assets);
  return assets;
}
```

---

## 📦 完整示例：小程序端完整流程

```javascript
// pages/index/index.js
Page({
  data: {
    features: [],
    token: ''
  },

  async onLoad() {
    // 1. 登录
    await this.login();

    // 2. 加载功能列表
    await this.loadFeatures();
  },

  // 登录
  async login() {
    const { code } = await wx.login();

    const res = await wx.request({
      url: 'http://localhost:3000/api/auth/wechat-login',
      method: 'POST',
      data: { code }
    });

    const { token } = res.data.data;
    wx.setStorageSync('token', token);
    this.setData({ token });
  },

  // 加载功能列表
  async loadFeatures() {
    const res = await wx.request({
      url: 'http://localhost:3000/api/features',
      method: 'GET',
      header: {
        'Authorization': `Bearer ${this.data.token}`
      }
    });

    this.setData({ features: res.data.data.features });
  },

  // 生成AI模特照片
  async generateAIModel() {
    try {
      wx.showLoading({ title: '处理中...' });

      // 1. 选择图片
      const { tempFilePaths } = await wx.chooseImage({ count: 1 });

      // 2. 上传图片
      const uploadRes = await wx.uploadFile({
        url: 'http://localhost:3000/api/media/upload',
        filePath: tempFilePaths[0],
        name: 'file',
        header: {
          'Authorization': `Bearer ${this.data.token}`
        }
      });

      const imageUrl = JSON.parse(uploadRes.data).data.url;

      // 3. 创建任务
      const taskRes = await wx.request({
        url: 'http://localhost:3000/api/task/create-by-feature',
        method: 'POST',
        header: {
          'Authorization': `Bearer ${this.data.token}`
        },
        data: {
          featureId: 'ai_model_12_pose',
          inputImageUrl: imageUrl,
          params: {
            scene: 'street',
            category: 'dress'
          }
        }
      });

      const taskId = taskRes.data.data.taskId;

      wx.hideLoading();
      wx.showToast({ title: '开始生成', icon: 'success' });

      // 4. 轮询任务状态
      this.pollTask(taskId);

    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
      console.error(error);
    }
  },

  // 轮询任务
  pollTask(taskId) {
    const timer = setInterval(async () => {
      const res = await wx.request({
        url: `http://localhost:3000/api/task/${taskId}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${this.data.token}`
        }
      });

      const task = res.data.data;

      if (task.status === 'completed') {
        clearInterval(timer);
        wx.showToast({ title: '生成完成!', icon: 'success' });

        // 跳转到结果页
        wx.navigateTo({
          url: `/pages/result/result?images=${task.outputUrl}`
        });

      } else if (task.status === 'failed') {
        clearInterval(timer);
        wx.showToast({ title: '生成失败', icon: 'none' });
      }
    }, 3000);
  }
});
```

---

## 🔧 注意事项

### 1. 小程序域名配置

**微信小程序需要在后台配置服务器域名:**

```
request合法域名: https://your-domain.com
uploadFile合法域名: https://your-domain.com
downloadFile合法域名: https://your-domain.com
```

**开发阶段可以在微信开发者工具里勾选"不校验合法域名"**

### 2. CORS跨域

**后端已配置CORS,支持跨域请求:**

```javascript
// backend/src/app.js
app.use(cors({
  origin: '*',
  credentials: true
}));
```

### 3. 图片上传限制

```javascript
// 后端限制
最大文件大小: 10MB
支持格式: jpg, jpeg, png, gif, webp
```

### 4. Token过期处理

```javascript
// 建议在请求拦截器里统一处理
wx.request({
  // ... 请求配置
  fail: (error) => {
    if (error.statusCode === 401) {
      // Token过期,重新登录
      wx.showModal({
        title: '登录已过期',
        content: '请重新登录',
        success: () => {
          wx.reLaunch({ url: '/pages/login/login' });
        }
      });
    }
  }
});
```

---

## 📱 支持的客户端总结

| 客户端类型 | 请求方式 | Token携带 | 文件上传 | 兼容性 |
|-----------|---------|----------|---------|--------|
| 微信小程序 | wx.request | Header | wx.uploadFile | ✅ 完美 |
| 支付宝小程序 | my.request | Header | my.uploadFile | ✅ 完美 |
| uniApp | uni.request | Header | uni.uploadFile | ✅ 完美 |
| iOS原生 | URLSession | Header | multipart/form-data | ✅ 完美 |
| Android原生 | OkHttp/Retrofit | Header | multipart/form-data | ✅ 完美 |
| Flutter | http/dio | Header | FormData | ✅ 完美 |
| React Native | fetch/axios | Header | FormData | ✅ 完美 |

---

## 🎯 总结

老王我这个后端是**标准RESTful API**,只要你的客户端能:
1. ✅ 发HTTP请求
2. ✅ 处理JSON数据
3. ✅ 在Header里带Token

那就能无缝对接！小程序、App、Web全支持！

**艹！快去对接吧,有问题再来找老王我!** 🚀
