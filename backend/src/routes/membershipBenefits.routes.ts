/**
 * Membership Benefits Routes
 * 艹，会员权益路由！
 */

import { Router } from 'express';
import benefitsController from '../controllers/membershipBenefits.controller';

const router = Router();

// 管理端路由（需要admin权限）
router.get('/admin/membership/benefits', benefitsController.listBenefits.bind(benefitsController));
router.post('/admin/membership/benefits', benefitsController.createBenefit.bind(benefitsController));
router.get('/admin/membership/benefits/:id', benefitsController.getBenefit.bind(benefitsController));
router.put('/admin/membership/benefits/:id', benefitsController.updateBenefit.bind(benefitsController));
router.delete('/admin/membership/benefits/:id', benefitsController.deleteBenefit.bind(benefitsController));

// 前台路由（公开访问）
router.get('/membership/benefits', benefitsController.getActiveBenefits.bind(benefitsController));

export default router;
