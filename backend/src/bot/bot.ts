import { Telegraf, Markup } from 'telegraf';
import { config } from '../config';
import { LicenseService } from '../services/license.service';
import { db } from '../db';
import { LicenseStatus } from '@prisma/client';

export const initBot = () => {
  if (!config.telegramBotToken) {
    console.log('Telegram bot disabled: TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  const bot = new Telegraf(config.telegramBotToken);

  const adminMiddleware = (ctx: any, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    if (config.telegramAdminIds.includes(userId || '')) {
      return next();
    }
    return ctx.reply(`ACCESS DENIED\n\nThis account is not authorized\nto access ZROK Control.`);
  };

  const getAdminId = (ctx: any) => ctx.from?.id.toString() || 'unknown';

  const mainMenu = () => Markup.inlineKeyboard([
    [Markup.button.callback('🔑 Generate Keys', 'menu_gen')],
    [Markup.button.callback('👥 Users', 'menu_users'), Markup.button.callback('📊 Analytics', 'menu_stats')],
    [Markup.button.callback('📜 Activity', 'menu_logs')]
  ]);

  bot.command('start', adminMiddleware, (ctx) => {
    ctx.reply(`ZROK CONTROL\n\nSystem Operational\nSelect an option:`, mainMenu());
  });

  // --- HOME ---
  bot.action('menu_home', adminMiddleware, (ctx: any) => {
    ctx.editMessageText(`ZROK CONTROL\n\nSystem Operational\nSelect an option:`, mainMenu());
  });

  // --- GENERATE KEYS ---
  bot.action('menu_gen', adminMiddleware, (ctx: any) => {
    ctx.editMessageText(`🔑 SELECT DURATION\nChoose the validity period for the new key:`, Markup.inlineKeyboard([
      [Markup.button.callback('3 Hours', 'gen_3h'), Markup.button.callback('6 Hours', 'gen_6h')],
      [Markup.button.callback('12 Hours', 'gen_12h'), Markup.button.callback('1 Day', 'gen_1d')],
      [Markup.button.callback('3 Days', 'gen_3d'), Markup.button.callback('7 Days', 'gen_7d')],
      [Markup.button.callback('15 Days', 'gen_15d'), Markup.button.callback('30 Days', 'gen_30d')],
      [Markup.button.callback('◀️ Back', 'menu_home')]
    ]));
  });

  const durations: Record<string, { days: number, label: string }> = {
    '3h': { days: 0.125, label: '3 Hours' },
    '6h': { days: 0.25, label: '6 Hours' },
    '12h': { days: 0.5, label: '12 Hours' },
    '1d': { days: 1, label: '1 Day' },
    '3d': { days: 3, label: '3 Days' },
    '7d': { days: 7, label: '7 Days' },
    '15d': { days: 15, label: '15 Days' },
    '30d': { days: 30, label: '30 Days' }
  };

  bot.action(/^gen_(.+)$/, adminMiddleware, async (ctx: any) => {
    const type = ctx.match[1];
    const dur = durations[type];
    if (!dur) return;

    try {
      const { key } = await LicenseService.createLicense(dur.days, 1, `Created via Bot (${dur.label})`, getAdminId(ctx));
      const expiresText = dur.days < 1 ? `${dur.label} after first use` : `${dur.days} days after first use`;
      
      ctx.editMessageText(
        `✅ KEY GENERATED\n\nKey: \`${key}\` (tap to copy)\nDuration: ${dur.label}\nExpires: ${expiresText}\nStatus: ACTIVE`,
        { parse_mode: 'MarkdownV2', ...Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', 'menu_gen'), Markup.button.callback('🏠 Home', 'menu_home')]]) }
      );
    } catch (e: any) {
      ctx.reply(`Error: ${e.message}`);
    }
  });

  // --- USERS ---
  bot.action('menu_users', adminMiddleware, async (ctx: any) => {
    const licenses = await db.licenseKey.findMany({ take: 20, orderBy: { createdAt: 'desc' } });
    if (licenses.length === 0) {
      return ctx.editMessageText('No users found.', Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', 'menu_home')]]));
    }

    const buttons = licenses.map(l => [Markup.button.callback(`${l.username || 'Unregistered'} (${l.status})`, `user_view_${l.id}`)]);
    buttons.push([Markup.button.callback('◀️ Back', 'menu_home')]);
    
    ctx.editMessageText(`👥 USERS LIST\nSelect a user to view details:`, Markup.inlineKeyboard(buttons));
  });

  bot.action(/^user_view_(.+)$/, adminMiddleware, async (ctx: any) => {
    const id = ctx.match[1];
    const lic = await db.licenseKey.findUnique({ where: { id }, include: { devices: true } });
    if (!lic) return ctx.answerCbQuery('User not found.');

    const lastDevice = lic.devices.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())[0];
    const maskedKey = lic.maskedKey || 'ZROK-****-*****';
    
    let msg = `👤 USER DETAILS\n\n`;
    msg += `Username: ${lic.username || 'Not registered'}\n`;
    msg += `Key: \`${maskedKey}\`\n`;
    msg += `Status: ${lic.status}\n`;
    msg += `Created: ${lic.createdAt.toLocaleDateString()}\n`;
    msg += `Expires: ${lic.expiresAt?.toLocaleDateString() || 'Not activated'}\n`;
    msg += `Last IP: ${lastDevice?.lastIp || 'N/A'}\n`;
    msg += `Device: ${lastDevice?.deviceIdentifier || 'N/A'}`;

    const actions = [];
    if (lic.status === 'ACTIVE') actions.push([Markup.button.callback('⏸️ Suspend', `user_suspend_${lic.id}`)]);
    if (lic.status === 'PAUSED') actions.push([Markup.button.callback('▶️ Reactivate', `user_resume_${lic.id}`)]);
    if (lic.status !== 'REVOKED') actions.push([Markup.button.callback('🚫 Revoke', `user_revoke_ask_${lic.id}`)]);
    
    actions.push([Markup.button.callback('◀️ Back to List', 'menu_users')]);

    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(actions) });
  });

  bot.action(/^user_suspend_(.+)$/, adminMiddleware, async (ctx: any) => {
    await LicenseService.pauseIndividual(ctx.match[1], getAdminId(ctx));
    ctx.answerCbQuery('License suspended.');
    ctx.editMessageText('✓ License suspended.', Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', `user_view_${ctx.match[1]}`)]]));
  });

  bot.action(/^user_resume_(.+)$/, adminMiddleware, async (ctx: any) => {
    await LicenseService.resumeIndividual(ctx.match[1], getAdminId(ctx));
    ctx.answerCbQuery('License reactivated.');
    ctx.editMessageText('✓ License reactivated.', Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', `user_view_${ctx.match[1]}`)]]));
  });

  bot.action(/^user_revoke_ask_(.+)$/, adminMiddleware, (ctx: any) => {
    ctx.editMessageText('⚠️ CONFIRM REVOKE\nThis action cannot be undone.', Markup.inlineKeyboard([
      [Markup.button.callback('Confirm Revoke', `user_revoke_confirm_${ctx.match[1]}`)],
      [Markup.button.callback('Cancel', `user_view_${ctx.match[1]}`)]
    ]));
  });

  bot.action(/^user_revoke_confirm_(.+)$/, adminMiddleware, async (ctx: any) => {
    await LicenseService.revoke(ctx.match[1], getAdminId(ctx));
    ctx.answerCbQuery('License revoked.');
    ctx.editMessageText('✓ License revoked.', Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', 'menu_users')]]));
  });

  // --- ANALYTICS ---
  bot.action('menu_stats', adminMiddleware, async (ctx: any) => {
    const keysCount = await db.licenseKey.count();
    const activeCount = await db.licenseKey.count({ where: { status: LicenseStatus.ACTIVE } });
    const devicesCount = await db.device.count();
    ctx.editMessageText(
      `📊 ZROK ANALYTICS\n\n• Total Keys: ${keysCount}\n• Active Keys: ${activeCount}\n• Linked Devices: ${devicesCount}`,
      Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', 'menu_home')]])
    );
  });

  bot.action('menu_logs', adminMiddleware, async (ctx: any) => {
    const logs = await db.auditLog.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    let msg = `📜 RECENT ACTIVITY:\n\n`;
    for (const log of logs) {
      msg += `• [${log.action}] (${log.createdAt.toLocaleTimeString()})\n`;
    }
    ctx.editMessageText(msg, Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', 'menu_home')]]));
  });

  bot.launch();
  console.log('ZROK Control Bot started (Inline Menu version)');
  return bot;
};
