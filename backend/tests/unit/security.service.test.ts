import securityService from '../../src/services/security.service.js';

describe('SecurityService data masking', () => {
  it('masks nested fields according to rules', () => {
    const payload = {
      user: {
        email: 'user@example.com'
      },
      profile: {
        phone: '13800138000'
      }
    };

    const masked = securityService.maskData(payload, [
      { field: 'user.email', type: 'email' },
      { field: 'profile.phone', type: 'phone' }
    ]);

    expect(masked.user.email).toContain('*');
    expect(masked.profile.phone).toContain('*');
    expect(masked.profile.phone).not.toEqual(payload.profile.phone);
  });

  it('falls back to generic masking when rule is unknown', () => {
    const payload = { token: 'abcdef1234567890' };
    const masked = securityService.maskData(payload, [
      { field: 'token', type: 'custom', customPattern: '[a-f]+' }
    ]);

    expect(masked.token).toMatch(/\*/);
  });
});
