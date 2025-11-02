/**
 * Membership Plans Routes
 * 艹，会员套餐路由！
 */

import { Router } from 'express';
import plansController from '../controllers/membershipPlans.controller';

const router = Router();

// 管理端路由（需要admin权限）
router.get('/admin/membership/plans', plansController.listPlans.bind(plansController));
router.post('/admin/membership/plans', plansController.createPlan.bind(plansController));
router.get('/admin/membership/plans/:id', plansController.getPlan.bind(plansController));
router.put('/admin/membership/plans/:id', plansController.updatePlan.bind(plansController));
router.delete('/admin/membership/plans/:id', plansController.deletePlan.bind(plansController));

// 艹，设置套餐权益
router.put('/admin/membership/plans/:id/benefits', plansController.setPlanBenefits.bind(plansController));

// 前台路由（公开访问）
router.get('/membership/plans', plansController.getActivePlans.bind(plansController));
router.get('/membership/plans/slug/:slug', plansController.getPlanBySlug.bind(plansController));

export default router;
