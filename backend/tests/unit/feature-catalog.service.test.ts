import featureCatalogService from '../../src/services/feature-catalog.service.js';

const service = featureCatalogService as any;

describe('FeatureCatalogService permissions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('grants access when permission type is user and ids match', async () => {
    const result = await service.evaluatePermission(
      { permission_type: 'user', permission_value: 'user-1' },
      'user-1',
      {}
    );

    expect(result).toBe(true);
  });

  it('denies membership permissions when user lacks membership', async () => {
    const result = await service.evaluatePermission(
      { permission_type: 'membership', permission_value: 'vip' },
      'user-2',
      { membership: 'basic' }
    );

    expect(result).toBe(false);
  });

  it('checkFeatureAccess returns true when evaluatePermission resolves true', async () => {
    const featureSpy = jest
      .spyOn(service, 'getFeatureByKey')
      .mockResolvedValue({ id: 'f1', is_active: true, is_public: true } as never);

    const permissionSpy = jest
      .spyOn(service, 'getFeaturePermissions')
      .mockResolvedValue([
        { permission_type: 'user', permission_value: 'user-3', is_granted: true }
      ] as never);

    const evaluateSpy = jest.spyOn(service, 'evaluatePermission').mockResolvedValue(true);

    const allowed = await featureCatalogService.checkFeatureAccess('feature-x', 'user-3', {});

    expect(allowed).toBe(true);
    expect(featureSpy).toHaveBeenCalled();
    expect(permissionSpy).toHaveBeenCalled();
    expect(evaluateSpy).toHaveBeenCalled();
  });
});
