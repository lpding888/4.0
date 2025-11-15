import { newEnforcer, type Enforcer } from 'casbin';
import { SequelizeAdapter } from 'casbin-sequelize-adapter';
import path from 'node:path';
import logger from '../../utils/logger.js';
import {
  PERMISSION_MATRIX,
  hasPermission,
  type UserRole,
  type Resource,
  type Action
} from '../../utils/rbac.js';

const MODEL_PATH = path.resolve(process.cwd(), 'src/security/casbin-model.conf');

let enforcerPromise: Promise<Enforcer | null> | null = null;

const isDisabled = (): boolean => process.env.CASBIN_DISABLED === 'true';

async function createAdapter() {
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = Number.parseInt(process.env.DB_PORT ?? '3306', 10);
  const username = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const database = process.env.DB_NAME ?? 'ai_photo';

  return SequelizeAdapter.newAdapter(
    {
      username,
      password,
      database,
      host,
      port,
      dialect: 'mysql',
      logging: false,
      define: {
        freezeTableName: true,
        timestamps: true
      }
    },
    true
  );
}

async function seedDefaultPolicies(enforcer: Enforcer): Promise<void> {
  const policies = await enforcer.getPolicy();
  if (policies.length > 0) {
    return;
  }

  for (const [role, resources] of Object.entries(PERMISSION_MATRIX)) {
    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions) {
        await enforcer.addPolicy(role, resource, action);
      }
    }
  }

  await enforcer.savePolicy();
  logger.info('[Casbin] 默认策略已初始化');
}

async function initEnforcer(): Promise<Enforcer | null> {
  if (isDisabled()) {
    logger.warn('[Casbin] 已禁用，继续使用本地 RBAC');
    return null;
  }

  const adapter = await createAdapter();
  const enforcer = await newEnforcer(MODEL_PATH, adapter);
  await seedDefaultPolicies(enforcer);
  return enforcer;
}

async function getEnforcer(): Promise<Enforcer | null> {
  if (isDisabled()) {
    return null;
  }
  if (!enforcerPromise) {
    enforcerPromise = initEnforcer().catch((error) => {
      logger.error('[Casbin] 初始化失败，回退到静态 RBAC', error);
      return null;
    });
  }
  return enforcerPromise;
}

export async function enforcePermission(
  subject: UserRole,
  resource: Resource,
  action: Action
): Promise<boolean> {
  const enforcer = await getEnforcer();
  if (!enforcer) {
    return hasPermission(subject, resource, action);
  }

  try {
    return await enforcer.enforce(subject, resource, action);
  } catch (error) {
    logger.error('[Casbin] enforce 失败，使用静态 RBAC 兜底', error);
    return hasPermission(subject, resource, action);
  }
}

export async function reloadPolicies(): Promise<void> {
  const enforcer = await getEnforcer();
  if (!enforcer) return;
  await enforcer.loadPolicy();
}

export async function addPolicy(subject: string, resource: string, action: string): Promise<void> {
  const enforcer = await getEnforcer();
  if (!enforcer) return;
  await enforcer.addPolicy(subject, resource, action);
  await enforcer.savePolicy();
}
