import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

const mockPrisma: any = {
  user: {
    findUnique: jest.fn()
  }
};

jest.mock('../src/index', () => ({
  prisma: mockPrisma
}));

import { createUpgradeHandler } from '../src/middleware/websocketAuth';
import { generateToken } from '../src/middleware/auth';
import { WS_CLOSE_CODES } from '../src/constants/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

const activeUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'member',
  organizationId: 'org-1',
  tenantId: 'tenant-1',
  isActive: true
};

const setup = () => {
  const ws: any = { close: jest.fn(), on: jest.fn() };
  const wss: any = { handleUpgrade: jest.fn((req: any, socket: any, head: any, done: any) => done(ws)) };
  const socket: any = { write: jest.fn(), destroy: jest.fn() };
  const onConnection = jest.fn();
  const upgrade = (url: string) => createUpgradeHandler(wss, onConnection)({ url } as any, socket, Buffer.alloc(0));
  return { ws, wss, socket, onConnection, upgrade };
};

const expectRejected = ({ wss, socket, onConnection }: ReturnType<typeof setup>) => {
  expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('401 Unauthorized'));
  expect(socket.destroy).toHaveBeenCalled();
  expect(wss.handleUpgrade).not.toHaveBeenCalled();
  expect(onConnection).not.toHaveBeenCalled();
};

describe('WebSocket handshake authentication', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(activeUser);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('accepts a valid token and takes the organization from the user, not from the URL', async () => {
    const context = setup();
    const token = generateToken('user-1', 'test@example.com', 'org-1', 'member');

    await context.upgrade(`/?token=${token}&org=org-other`);

    expect(context.socket.destroy).not.toHaveBeenCalled();
    expect(context.onConnection).toHaveBeenCalledWith(context.ws, {
      id: 'user-1',
      email: 'test@example.com',
      organizationId: 'org-1',
      tenantId: 'tenant-1',
      role: 'member'
    });
  });

  it('rejects a handshake without a token (the old ?org= form)', async () => {
    const context = setup();
    await context.upgrade('/?org=org-1');
    expectRejected(context);
  });

  const invalidTokens = {
    'signed with a different secret': () => jwt.sign({ userId: 'user-1' }, 'attacker-secret'),
    'expired': () => jwt.sign({ userId: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET),
    'malformed': () => 'not-a-jwt'
  };

  for (const [name, makeToken] of Object.entries(invalidTokens)) {
    it(`rejects a token that is ${name}`, async () => {
      const context = setup();
      await context.upgrade(`/?token=${makeToken()}`);
      expectRejected(context);
    });
  }

  it('rejects a token of a deactivated user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });
    const context = setup();
    await context.upgrade(`/?token=${generateToken('user-1', 'test@example.com', 'org-1', 'member')}`);
    expectRejected(context);
  });

  it('rejects a token of a deleted user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const context = setup();
    await context.upgrade(`/?token=${generateToken('user-1', 'test@example.com', 'org-1', 'member')}`);
    expectRejected(context);
  });

  it('rejects the handshake if the user lookup fails', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB down'));
    const context = setup();
    await context.upgrade(`/?token=${generateToken('user-1', 'test@example.com', 'org-1', 'member')}`);
    expectRejected(context);
  });

  it('closes the connection when the token expires', async () => {
    jest.useFakeTimers();
    const context = setup();
    const token = jwt.sign({ userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 }, JWT_SECRET);

    await context.upgrade(`/?token=${token}`);

    jest.advanceTimersByTime(59 * 1000);
    expect(context.ws.close).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(context.ws.close).toHaveBeenCalledWith(WS_CLOSE_CODES.TOKEN_EXPIRED, 'Token expired');
  });
});
