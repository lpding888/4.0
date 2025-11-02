/**
 * 国际化错误消息配置
 *
 * 支持多语言错误消息，根据Accept-Language或用户偏好语言返回对应消息
 */

const { ERROR_CODES } = require('./error-codes');

// 中文简体消息
const zh_CN = {
  // 通用错误
  [ERROR_CODES.SUCCESS]: '操作成功',
  [ERROR_CODES.UNKNOWN_ERROR]: '未知错误，请稍后重试',
  [ERROR_CODES.INVALID_REQUEST]: '无效请求',
  [ERROR_CODES.MISSING_PARAMETERS]: '缺少必需参数',
  [ERROR_CODES.INVALID_PARAMETERS]: '参数无效',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后重试',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: '服务器内部错误',
  [ERROR_CODES.DATABASE_ERROR]: '数据库错误',
  [ERROR_CODES.CACHE_ERROR]: '缓存错误',
  [ERROR_CODES.QUEUE_ERROR]: '队列错误',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: '外部服务错误',

  // 认证错误
  [ERROR_CODES.UNAUTHORIZED]: '未授权访问',
  [ERROR_CODES.INVALID_TOKEN]: '无效令牌',
  [ERROR_CODES.TOKEN_EXPIRED]: '令牌已过期',
  [ERROR_CODES.TOKEN_BLACKLISTED]: '令牌已被吊销',
  [ERROR_CODES.INVALID_CREDENTIALS]: '无效凭据',
  [ERROR_CODES.ACCOUNT_LOCKED]: '账户已被锁定',
  [ERROR_CODES.ACCOUNT_DISABLED]: '账户已被禁用',
  [ERROR_CODES.ACCOUNT_NOT_FOUND]: '账户不存在',
  [ERROR_CODES.PASSWORD_INCORRECT]: '密码错误',
  [ERROR_CODES.LOGIN_REQUIRED]: '需要登录',

  // 登录错误
  [ERROR_CODES.LOGIN_ATTEMPTS_EXCEEDED]: '登录尝试次数过多，请稍后重试',
  [ERROR_CODES.LOGIN_METHOD_NOT_SUPPORTED]: '不支持的登录方式',
  [ERROR_CODES.LOGIN_METHOD_NOT_BOUND]: '该登录方式未绑定',
  [ERROR_CODES.VERIFICATION_CODE_INVALID]: '验证码错误',
  [ERROR_CODES.VERIFICATION_CODE_EXPIRED]: '验证码已过期',
  [ERROR_CODES.VERIFICATION_SEND_LIMIT]: '验证码发送过于频繁',
  [ERROR_CODES.EMAIL_ALREADY_EXISTS]: '邮箱已被注册',
  [ERROR_CODES.PHONE_ALREADY_EXISTS]: '手机号已被注册',
  [ERROR_CODES.SOCIAL_LOGIN_FAILED]: '第三方登录失败',

  // 权限错误
  [ERROR_CODES.PERMISSION_DENIED]: '权限不足',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: '权限不足',
  [ERROR_CODES.ROLE_NOT_FOUND]: '角色不存在',
  [ERROR_CODES.ROLE_ASSIGNMENT_FAILED]: '角色分配失败',
  [ERROR_CODES.RESOURCE_ACCESS_DENIED]: '资源访问被拒绝',
  [ERROR_CODES.ADMIN_REQUIRED]: '需要管理员权限',

  // 用户错误
  [ERROR_CODES.USER_NOT_FOUND]: '用户不存在',
  [ERROR_CODES.USER_ALREADY_EXISTS]: '用户已存在',
  [ERROR_CODES.USER_PROFILE_INCOMPLETE]: '用户资料不完整',
  [ERROR_CODES.USER_QUOTA_EXCEEDED]: '用户配额已用完',
  [ERROR_CODES.USER_MEMBERSHIP_EXPIRED]: '会员已过期',
  [ERROR_CODES.USER_SUBSCRIPTION_INACTIVE]: '订阅未激活',
  [ERROR_CODES.INVITE_CODE_INVALID]: '邀请码无效',
  [ERROR_CODES.INVITE_CODE_USED]: '邀请码已被使用',
  [ERROR_CODES.INVITE_CODE_EXPIRED]: '邀请码已过期',
  [ERROR_CODES.REFERRAL_CODE_INVALID]: '推荐码无效',
  [ERROR_CODES.REFERRAL_NOT_FOUND]: '推荐人不存在',

  // 任务错误
  [ERROR_CODES.TASK_NOT_FOUND]: '任务不存在',
  [ERROR_CODES.TASK_CREATION_FAILED]: '任务创建失败',
  [ERROR_CODES.TASK_PROCESSING_FAILED]: '任务处理失败',
  [ERROR_CODES.TASK_TIMEOUT]: '任务处理超时',
  [ERROR_CODES.TASK_CANCELLED]: '任务已取消',
  [ERROR_CODES.TASK_QUOTA_EXCEEDED]: '任务配额已用完',
  [ERROR_CODES.TASK_INVALID_PARAMETERS]: '任务参数无效',
  [ERROR_CODES.TASK_PROCESSOR_UNAVAILABLE]: '任务处理器不可用',
  [ERROR_CODES.TASK_DEPENDENCY_FAILED]: '任务依赖失败',
  [ERROR_CODES.TASK_RESULT_EXPIRED]: '任务结果已过期',

  // 文件错误
  [ERROR_CODES.FILE_NOT_FOUND]: '文件不存在',
  [ERROR_CODES.FILE_TOO_LARGE]: '文件过大',
  [ERROR_CODES.FILE_TYPE_NOT_SUPPORTED]: '不支持的文件类型',
  [ERROR_CODES.FILE_UPLOAD_FAILED]: '文件上传失败',
  [ERROR_CODES.FILE_PROCESSING_FAILED]: '文件处理失败',
  [ERROR_CODES.FILE_DOWNLOAD_FAILED]: '文件下载失败',
  [ERROR_CODES.FILE_CORRUPTED]: '文件已损坏',
  [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: '存储配额已用完',

  // AI处理错误
  [ERROR_CODES.AI_PROCESSING_FAILED]: 'AI处理失败',
  [ERROR_CODES.AI_SERVICE_UNAVAILABLE]: 'AI服务不可用',
  [ERROR_CODES.AI_QUOTA_EXCEEDED]: 'AI配额已用完',
  [ERROR_CODES.AI_CONTENT_POLICY_VIOLATION]: '内容违反政策',
  [ERROR_CODES.AI_PROCESSING_TIMEOUT]: 'AI处理超时',
  [ERROR_CODES.AI_INVALID_INPUT_FORMAT]: '输入格式无效',

  // 支付错误
  [ERROR_CODES.PAYMENT_REQUIRED]: '需要付费',
  [ERROR_CODES.PAYMENT_FAILED]: '支付失败',
  [ERROR_CODES.PAYMENT_CANCELLED]: '支付已取消',
  [ERROR_CODES.PAYMENT_TIMEOUT]: '支付超时',
  [ERROR_CODES.PAYMENT_METHOD_NOT_SUPPORTED]: '不支持的支付方式',
  [ERROR_CODES.ORDER_NOT_FOUND]: '订单不存在',
  [ERROR_CODES.ORDER_EXPIRED]: '订单已过期',
  [ERROR_CODES.ORDER_ALREADY_PAID]: '订单已支付',
  [ERROR_CODES.REFUND_FAILED]: '退款失败',
  [ERROR_CODES.REFUND_AMOUNT_INVALID]: '退款金额无效',
  [ERROR_CODES.PAYMENT_GATEWAY_ERROR]: '支付网关错误',
  [ERROR_CODES.INSUFFICIENT_BALANCE]: '余额不足',
  [ERROR_CODES.PAYMENT_VERIFICATION_FAILED]: '支付验证失败',

  // 分销错误
  [ERROR_CODES.DISTRIBUTOR_NOT_FOUND]: '分销商不存在',
  [ERROR_CODES.DISTRIBUTION_NOT_ACTIVE]: '分销未激活',
  [ERROR_CODES.COMMISSION_CALCULATION_FAILED]: '佣金计算失败',
  [ERROR_CODES.WITHDRAWAL_FAILED]: '提现失败',
  [ERROR_CODES.WITHDRAWAL_AMOUNT_INVALID]: '提现金额无效',
  [ERROR_CODES.WITHDRAWAL_LIMIT_EXCEEDED]: '超出提现限额',
  [ERROR_CODES.DISTRIBUTION_RULE_NOT_FOUND]: '分销规则不存在',
  [ERROR_CODES.COMMISSION_FREEZE_FAILED]: '佣金冻结失败',
  [ERROR_CODES.COMMISSION_UNFREEZE_FAILED]: '佣金解冻失败',

  // 系统错误
  [ERROR_CODES.CONFIG_NOT_FOUND]: '配置不存在',
  [ERROR_CODES.CONFIG_VALIDATION_FAILED]: '配置验证失败',
  [ERROR_CODES.FEATURE_NOT_ENABLED]: '功能未启用',
  [ERROR_CODES.FEATURE_NOT_AVAILABLE]: '功能不可用',
  [ERROR_CODES.SYSTEM_MAINTENANCE]: '系统维护中',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: '服务不可用',
  [ERROR_CODES.RATE_LIMIT_CONFIG_INVALID]: '限流配置无效',
  [ERROR_CODES.CACHE_VERSION_CONFLICT]: '缓存版本冲突',
  [ERROR_CODES.DATABASE_MIGRATION_FAILED]: '数据库迁移失败',
  [ERROR_CODES.ENVIRONMENT_VARIABLE_MISSING]: '环境变量缺失',

  // 网络错误
  [ERROR_CODES.CONNECTION_FAILED]: '连接失败',
  [ERROR_CODES.REQUEST_TIMEOUT]: '请求超时',
  [ERROR_CODES.DNS_RESOLUTION_FAILED]: 'DNS解析失败',
  [ERROR_CODES.SSL_VERIFICATION_FAILED]: 'SSL验证失败',
  [ERROR_CODES.PROXY_ERROR]: '代理错误',
  [ERROR_CODES.BANDWIDTH_LIMIT_EXCEEDED]: '带宽限制',
  [ERROR_CODES.WEBSOCKET_CONNECTION_FAILED]: 'WebSocket连接失败',
  [ERROR_CODES.NOTIFICATION_SEND_FAILED]: '通知发送失败',

  // 验证错误
  [ERROR_CODES.DATA_VALIDATION_FAILED]: '数据验证失败',
  [ERROR_CODES.EMAIL_FORMAT_INVALID]: '邮箱格式无效',
  [ERROR_CODES.PHONE_FORMAT_INVALID]: '手机号格式无效',
  [ERROR_CODES.PASSWORD_TOO_WEAK]: '密码过于简单',
  [ERROR_CODES.PASSWORD_MISMATCH]: '密码不匹配',
  [ERROR_CODES.URL_FORMAT_INVALID]: 'URL格式无效',
  [ERROR_CODES.DATE_FORMAT_INVALID]: '日期格式无效',
  [ERROR_CODES.NUMBER_OUT_OF_RANGE]: '数字超出范围',
  [ERROR_CODES.STRING_TOO_LONG]: '字符串过长',
  [ERROR_CODES.STRING_TOO_SHORT]: '字符串过短',
  [ERROR_CODES.REQUIRED_FIELD_MISSING]: '缺少必需字段',
  [ERROR_CODES.DUPLICATE_VALUE]: '值重复',
  [ERROR_CODES.FOREIGN_KEY_CONSTRAINT]: '外键约束错误',
  [ERROR_CODES.UNIQUE_CONSTRAINT]: '唯一约束错误',

  // 系统消息
  'error.stats_reset': '错误统计数据已重置',
  'error.test_success': '测试错误处理成功',
  'error.export_success': '错误数据导出成功',

  // 功能目录消息
  'features.retrieved_success': '功能列表获取成功',
  'feature.created_success': '功能创建成功',
  'feature.updated_success': '功能更新成功',
  'feature.deleted_success': '功能删除成功',
  'feature.configurations_set_success': '功能配置设置成功',
  'feature.usage_recorded': '功能使用记录成功',
  'feature.access_denied': '功能访问被拒绝',
  'feature.not_found': '功能不存在',
  'feature.already_exists': '功能已存在',
  'feature.configuration.invalid': '功能配置无效',
  'feature.permission.insufficient': '功能权限不足'
};

// 英文消息
const en_US = {
  // 通用错误
  [ERROR_CODES.SUCCESS]: 'Operation successful',
  [ERROR_CODES.UNKNOWN_ERROR]: 'Unknown error, please try again later',
  [ERROR_CODES.INVALID_REQUEST]: 'Invalid request',
  [ERROR_CODES.MISSING_PARAMETERS]: 'Missing required parameters',
  [ERROR_CODES.INVALID_PARAMETERS]: 'Invalid parameters',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests, please try again later',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [ERROR_CODES.DATABASE_ERROR]: 'Database error',
  [ERROR_CODES.CACHE_ERROR]: 'Cache error',
  [ERROR_CODES.QUEUE_ERROR]: 'Queue error',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service error',

  // 认证错误
  [ERROR_CODES.UNAUTHORIZED]: 'Unauthorized access',
  [ERROR_CODES.INVALID_TOKEN]: 'Invalid token',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Token expired',
  [ERROR_CODES.TOKEN_BLACKLISTED]: 'Token has been revoked',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid credentials',
  [ERROR_CODES.ACCOUNT_LOCKED]: 'Account is locked',
  [ERROR_CODES.ACCOUNT_DISABLED]: 'Account is disabled',
  [ERROR_CODES.ACCOUNT_NOT_FOUND]: 'Account not found',
  [ERROR_CODES.PASSWORD_INCORRECT]: 'Incorrect password',
  [ERROR_CODES.LOGIN_REQUIRED]: 'Login required',

  // 登录错误
  [ERROR_CODES.LOGIN_ATTEMPTS_EXCEEDED]: 'Too many login attempts, please try again later',
  [ERROR_CODES.LOGIN_METHOD_NOT_SUPPORTED]: 'Unsupported login method',
  [ERROR_CODES.LOGIN_METHOD_NOT_BOUND]: 'Login method not bound',
  [ERROR_CODES.VERIFICATION_CODE_INVALID]: 'Invalid verification code',
  [ERROR_CODES.VERIFICATION_CODE_EXPIRED]: 'Verification code expired',
  [ERROR_CODES.VERIFICATION_SEND_LIMIT]: 'Verification code sent too frequently',
  [ERROR_CODES.EMAIL_ALREADY_EXISTS]: 'Email already registered',
  [ERROR_CODES.PHONE_ALREADY_EXISTS]: 'Phone already registered',
  [ERROR_CODES.SOCIAL_LOGIN_FAILED]: 'Third-party login failed',

  // 权限错误
  [ERROR_CODES.PERMISSION_DENIED]: 'Permission denied',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
  [ERROR_CODES.ROLE_NOT_FOUND]: 'Role not found',
  [ERROR_CODES.ROLE_ASSIGNMENT_FAILED]: 'Role assignment failed',
  [ERROR_CODES.RESOURCE_ACCESS_DENIED]: 'Resource access denied',
  [ERROR_CODES.ADMIN_REQUIRED]: 'Admin privileges required',

  // 用户错误
  [ERROR_CODES.USER_NOT_FOUND]: 'User not found',
  [ERROR_CODES.USER_ALREADY_EXISTS]: 'User already exists',
  [ERROR_CODES.USER_PROFILE_INCOMPLETE]: 'User profile incomplete',
  [ERROR_CODES.USER_QUOTA_EXCEEDED]: 'User quota exceeded',
  [ERROR_CODES.USER_MEMBERSHIP_EXPIRED]: 'Membership expired',
  [ERROR_CODES.USER_SUBSCRIPTION_INACTIVE]: 'Subscription inactive',
  [ERROR_CODES.INVITE_CODE_INVALID]: 'Invalid invite code',
  [ERROR_CODES.INVITE_CODE_USED]: 'Invite code already used',
  [ERROR_CODES.INVITE_CODE_EXPIRED]: 'Invite code expired',
  [ERROR_CODES.REFERRAL_CODE_INVALID]: 'Invalid referral code',
  [ERROR_CODES.REFERRAL_NOT_FOUND]: 'Referrer not found',

  // 任务错误
  [ERROR_CODES.TASK_NOT_FOUND]: 'Task not found',
  [ERROR_CODES.TASK_CREATION_FAILED]: 'Task creation failed',
  [ERROR_CODES.TASK_PROCESSING_FAILED]: 'Task processing failed',
  [ERROR_CODES.TASK_TIMEOUT]: 'Task processing timeout',
  [ERROR_CODES.TASK_CANCELLED]: 'Task cancelled',
  [ERROR_CODES.TASK_QUOTA_EXCEEDED]: 'Task quota exceeded',
  [ERROR_CODES.TASK_INVALID_PARAMETERS]: 'Invalid task parameters',
  [ERROR_CODES.TASK_PROCESSOR_UNAVAILABLE]: 'Task processor unavailable',
  [ERROR_CODES.TASK_DEPENDENCY_FAILED]: 'Task dependency failed',
  [ERROR_CODES.TASK_RESULT_EXPIRED]: 'Task result expired',

  // 文件错误
  [ERROR_CODES.FILE_NOT_FOUND]: 'File not found',
  [ERROR_CODES.FILE_TOO_LARGE]: 'File too large',
  [ERROR_CODES.FILE_TYPE_NOT_SUPPORTED]: 'Unsupported file type',
  [ERROR_CODES.FILE_UPLOAD_FAILED]: 'File upload failed',
  [ERROR_CODES.FILE_PROCESSING_FAILED]: 'File processing failed',
  [ERROR_CODES.FILE_DOWNLOAD_FAILED]: 'File download failed',
  [ERROR_CODES.FILE_CORRUPTED]: 'File corrupted',
  [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded',

  // AI处理错误
  [ERROR_CODES.AI_PROCESSING_FAILED]: 'AI processing failed',
  [ERROR_CODES.AI_SERVICE_UNAVAILABLE]: 'AI service unavailable',
  [ERROR_CODES.AI_QUOTA_EXCEEDED]: 'AI quota exceeded',
  [ERROR_CODES.AI_CONTENT_POLICY_VIOLATION]: 'Content policy violation',
  [ERROR_CODES.AI_PROCESSING_TIMEOUT]: 'AI processing timeout',
  [ERROR_CODES.AI_INVALID_INPUT_FORMAT]: 'Invalid input format',

  // 支付错误
  [ERROR_CODES.PAYMENT_REQUIRED]: 'Payment required',
  [ERROR_CODES.PAYMENT_FAILED]: 'Payment failed',
  [ERROR_CODES.PAYMENT_CANCELLED]: 'Payment cancelled',
  [ERROR_CODES.PAYMENT_TIMEOUT]: 'Payment timeout',
  [ERROR_CODES.PAYMENT_METHOD_NOT_SUPPORTED]: 'Unsupported payment method',
  [ERROR_CODES.ORDER_NOT_FOUND]: 'Order not found',
  [ERROR_CODES.ORDER_EXPIRED]: 'Order expired',
  [ERROR_CODES.ORDER_ALREADY_PAID]: 'Order already paid',
  [ERROR_CODES.REFUND_FAILED]: 'Refund failed',
  [ERROR_CODES.REFUND_AMOUNT_INVALID]: 'Invalid refund amount',
  [ERROR_CODES.PAYMENT_GATEWAY_ERROR]: 'Payment gateway error',
  [ERROR_CODES.INSUFFICIENT_BALANCE]: 'Insufficient balance',
  [ERROR_CODES.PAYMENT_VERIFICATION_FAILED]: 'Payment verification failed',

  // 分销错误
  [ERROR_CODES.DISTRIBUTOR_NOT_FOUND]: 'Distributor not found',
  [ERROR_CODES.DISTRIBUTION_NOT_ACTIVE]: 'Distribution not active',
  [ERROR_CODES.COMMISSION_CALCULATION_FAILED]: 'Commission calculation failed',
  [ERROR_CODES.WITHDRAWAL_FAILED]: 'Withdrawal failed',
  [ERROR_CODES.WITHDRAWAL_AMOUNT_INVALID]: 'Invalid withdrawal amount',
  [ERROR_CODES.WITHDRAWAL_LIMIT_EXCEEDED]: 'Withdrawal limit exceeded',
  [ERROR_CODES.DISTRIBUTION_RULE_NOT_FOUND]: 'Distribution rule not found',
  [ERROR_CODES.COMMISSION_FREEZE_FAILED]: 'Commission freeze failed',
  [ERROR_CODES.COMMISSION_UNFREEZE_FAILED]: 'Commission unfreeze failed',

  // 系统错误
  [ERROR_CODES.CONFIG_NOT_FOUND]: 'Configuration not found',
  [ERROR_CODES.CONFIG_VALIDATION_FAILED]: 'Configuration validation failed',
  [ERROR_CODES.FEATURE_NOT_ENABLED]: 'Feature not enabled',
  [ERROR_CODES.FEATURE_NOT_AVAILABLE]: 'Feature not available',
  [ERROR_CODES.SYSTEM_MAINTENANCE]: 'System under maintenance',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [ERROR_CODES.RATE_LIMIT_CONFIG_INVALID]: 'Invalid rate limit configuration',
  [ERROR_CODES.CACHE_VERSION_CONFLICT]: 'Cache version conflict',
  [ERROR_CODES.DATABASE_MIGRATION_FAILED]: 'Database migration failed',
  [ERROR_CODES.ENVIRONMENT_VARIABLE_MISSING]: 'Environment variable missing',

  // 网络错误
  [ERROR_CODES.CONNECTION_FAILED]: 'Connection failed',
  [ERROR_CODES.REQUEST_TIMEOUT]: 'Request timeout',
  [ERROR_CODES.DNS_RESOLUTION_FAILED]: 'DNS resolution failed',
  [ERROR_CODES.SSL_VERIFICATION_FAILED]: 'SSL verification failed',
  [ERROR_CODES.PROXY_ERROR]: 'Proxy error',
  [ERROR_CODES.BANDWIDTH_LIMIT_EXCEEDED]: 'Bandwidth limit exceeded',
  [ERROR_CODES.WEBSOCKET_CONNECTION_FAILED]: 'WebSocket connection failed',
  [ERROR_CODES.NOTIFICATION_SEND_FAILED]: 'Notification send failed',

  // 验证错误
  [ERROR_CODES.DATA_VALIDATION_FAILED]: 'Data validation failed',
  [ERROR_CODES.EMAIL_FORMAT_INVALID]: 'Invalid email format',
  [ERROR_CODES.PHONE_FORMAT_INVALID]: 'Invalid phone format',
  [ERROR_CODES.PASSWORD_TOO_WEAK]: 'Password too weak',
  [ERROR_CODES.PASSWORD_MISMATCH]: 'Password mismatch',
  [ERROR_CODES.URL_FORMAT_INVALID]: 'Invalid URL format',
  [ERROR_CODES.DATE_FORMAT_INVALID]: 'Invalid date format',
  [ERROR_CODES.NUMBER_OUT_OF_RANGE]: 'Number out of range',
  [ERROR_CODES.STRING_TOO_LONG]: 'String too long',
  [ERROR_CODES.STRING_TOO_SHORT]: 'String too short',
  [ERROR_CODES.REQUIRED_FIELD_MISSING]: 'Missing required field',
  [ERROR_CODES.DUPLICATE_VALUE]: 'Duplicate value',
  [ERROR_CODES.FOREIGN_KEY_CONSTRAINT]: 'Foreign key constraint error',
  [ERROR_CODES.UNIQUE_CONSTRAINT]: 'Unique constraint error',

  // 系统消息
  'error.stats_reset': 'Error statistics reset successfully',
  'error.test_success': 'Test error handling successful',
  'error.export_success': 'Error data exported successfully',

  // 功能目录消息
  'features.retrieved_success': 'Features retrieved successfully',
  'feature.created_success': 'Feature created successfully',
  'feature.updated_success': 'Feature updated successfully',
  'feature.deleted_success': 'Feature deleted successfully',
  'feature.configurations_set_success': 'Feature configurations set successfully',
  'feature.usage_recorded': 'Feature usage recorded successfully',
  'feature.access_denied': 'Feature access denied',
  'feature.not_found': 'Feature not found',
  'feature.already_exists': 'Feature already exists',
  'feature.configuration.invalid': 'Invalid feature configuration',
  'feature.permission.insufficient': 'Insufficient feature permissions'
};

// 日文消息
const ja_JP = {
  // 通用错误
  [ERROR_CODES.SUCCESS]: '操作が成功しました',
  [ERROR_CODES.UNKNOWN_ERROR]: '不明なエラー、後でもう一度お試しください',
  [ERROR_CODES.INVALID_REQUEST]: '無効なリクエスト',
  [ERROR_CODES.MISSING_PARAMETERS]: '必須パラメータが不足しています',
  [ERROR_CODES.INVALID_PARAMETERS]: '無効なパラメータ',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'リクエストが頻繁すぎます、後でもう一度お試しください',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 'サーバー内部エラー',
  [ERROR_CODES.DATABASE_ERROR]: 'データベースエラー',
  [ERROR_CODES.CACHE_ERROR]: 'キャッシュエラー',
  [ERROR_CODES.QUEUE_ERROR]: 'キューエラー',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: '外部サービスエラー',

  // 认证错误
  [ERROR_CODES.UNAUTHORIZED]: '認証されていません',
  [ERROR_CODES.INVALID_TOKEN]: '無効なトークン',
  [ERROR_CODES.TOKEN_EXPIRED]: 'トークンが期限切れ',
  [ERROR_CODES.TOKEN_BLACKLISTED]: 'トークンが無効化されています',
  [ERROR_CODES.INVALID_CREDENTIALS]: '無効な認証情報',
  [ERROR_CODES.ACCOUNT_LOCKED]: 'アカウントがロックされています',
  [ERROR_CODES.ACCOUNT_DISABLED]: 'アカウントが無効化されています',
  [ERROR_CODES.ACCOUNT_NOT_FOUND]: 'アカウントが見つかりません',
  [ERROR_CODES.PASSWORD_INCORRECT]: 'パスワードが正しくありません',
  [ERROR_CODES.LOGIN_REQUIRED]: 'ログインが必要です',

  // 登录错误
  [ERROR_CODES.LOGIN_ATTEMPTS_EXCEEDED]: 'ログイン試行回数が多すぎます、後でもう一度お試しください',
  [ERROR_CODES.LOGIN_METHOD_NOT_SUPPORTED]: 'サポートされていないログイン方法',
  [ERROR_CODES.LOGIN_METHOD_NOT_BOUND]: 'ログイン方法がバインドされていません',
  [ERROR_CODES.VERIFICATION_CODE_INVALID]: '無効な認証コード',
  [ERROR_CODES.VERIFICATION_CODE_EXPIRED]: '認証コードが期限切れ',
  [ERROR_CODES.VERIFICATION_SEND_LIMIT]: '認証コードの送信が頻繁すぎます',
  [ERROR_CODES.EMAIL_ALREADY_EXISTS]: 'メールアドレスは既に登録されています',
  [ERROR_CODES.PHONE_ALREADY_EXISTS]: '電話番号は既に登録されています',
  [ERROR_CODES.SOCIAL_LOGIN_FAILED]: 'サードパーティログインに失敗しました',

  // 权限错误
  [ERROR_CODES.PERMISSION_DENIED]: 'アクセス許可がありません',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: '権限が不足しています',
  [ERROR_CODES.ROLE_NOT_FOUND]: 'ロールが見つかりません',
  [ERROR_CODES.ROLE_ASSIGNMENT_FAILED]: 'ロール割り当てに失敗しました',
  [ERROR_CODES.RESOURCE_ACCESS_DENIED]: 'リソースへのアクセスが拒否されました',
  [ERROR_CODES.ADMIN_REQUIRED]: '管理者権限が必要です',

  // 用户错误
  [ERROR_CODES.USER_NOT_FOUND]: 'ユーザーが見つかりません',
  [ERROR_CODES.USER_ALREADY_EXISTS]: 'ユーザーは既に存在します',
  [ERROR_CODES.USER_PROFILE_INCOMPLETE]: 'ユーザープロフィールが不完全です',
  [ERROR_CODES.USER_QUOTA_EXCEEDED]: 'ユーザークォータを超過しました',
  [ERROR_CODES.USER_MEMBERSHIP_EXPIRED]: 'メンバーシップが期限切れです',
  [ERROR_CODES.USER_SUBSCRIPTION_INACTIVE]: 'サブスクリプションが非アクティブです',
  [ERROR_CODES.INVITE_CODE_INVALID]: '無効な招待コード',
  [ERROR_CODES.INVITE_CODE_USED]: '招待コードは既に使用されています',
  [ERROR_CODES.INVITE_CODE_EXPIRED]: '招待コードが期限切れです',
  [ERROR_CODES.REFERRAL_CODE_INVALID]: '無効な紹介コード',
  [ERROR_CODES.REFERRAL_NOT_FOUND]: '紹介者が見つかりません',

  // 其他错误消息...
  [ERROR_CODES.TASK_NOT_FOUND]: 'タスクが見つかりません',
  [ERROR_CODES.TASK_CREATION_FAILED]: 'タスク作成に失敗しました',
  [ERROR_CODES.TASK_PROCESSING_FAILED]: 'タスク処理に失敗しました',
  [ERROR_CODES.PAYMENT_REQUIRED]: '支払いが必要です',
  [ERROR_CODES.PAYMENT_FAILED]: '支払いに失敗しました',
  [ERROR_CODES.FILE_NOT_FOUND]: 'ファイルが見つかりません',
  [ERROR_CODES.FILE_TOO_LARGE]: 'ファイルが大きすぎます',
  [ERROR_CODES.DATA_VALIDATION_FAILED]: 'データ検証に失敗しました',
  [ERROR_CODES.EMAIL_FORMAT_INVALID]: 'メールアドレス形式が無効です',
  [ERROR_CODES.PHONE_FORMAT_INVALID]: '電話番号形式が無効です'
};

// 所有支持的语言
const SUPPORTED_LANGUAGES = {
  'zh-CN': { name: '简体中文', messages: zh_CN },
  'en-US': { name: 'English', messages: en_US },
  'ja-JP': { name: '日本語', messages: ja_JP }
};

// 默认语言
const DEFAULT_LANGUAGE = 'zh-CN';

module.exports = {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  zh_CN,
  en_US,
  ja_JP
};