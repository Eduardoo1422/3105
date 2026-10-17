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

  const controlMenu = Markup.inlineKeyboard([
    [Markup.button.callback('🔑 Licenses', 'menu_licenses'), Markup.button.callback('📦 Resources', 'menu_resources')],
    [Markup.button.callback('📱 Devices', 'menu_devices'), Markup.button.callback('📊 Analytics', 'menu_analytics')],
    [Markup.button.callback('📜 Activity', 'menu_activity'), Markup.button.callback('⚙️ System', 'menu_system')]
  ]);

  bot.command('start', adminMiddleware, (ctx) => {
    ctx.reply(
      `ZROK CONTROL\n\nSystem status\n● Operational\n\nAPI       ● Online\nDatabase  ● Online\nBot       ● Online`,
      controlMenu
    );
  });

  bot.command('status', adminMiddleware, (ctx) => {
    ctx.reply(
      `ZROK SYSTEM HEALTH\n\nAPI              ● OPERATIONAL\nDATABASE         ● OPERATIONAL\nTELEGRAM BOT     ● OPERATIONAL\nRESOURCES        ● OPERATIONAL\nAUTHENTICATION   ● OPERATIONAL`,
      controlMenu
    );
  });

  bot.action('menu_home', adminMiddleware, (ctx: any) => {
    ctx.editMessageText(
      `ZROK CONTROL\n\nSystem status\n● Operational\n\nAPI       ● Online\nDatabase  ● Online\nBot       ● Online`,
      controlMenu
    );
  });

  bot.action('menu_licenses', adminMiddleware, (ctx: any) => {
    ctx.editMessageText(
      `🔑 ZROK LICENSES MANAGEMENT\n\nCommands:\n/key_create <days> [maxDevices]\n/key_list\n/key_info <keyIdentifier>\n/key_pause <keyIdentifier>\n/key_resume <keyIdentifier>\n/key_revoke <keyIdentifier>\n/keys_pause_all\n/keys_resume_all`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📋 List Keys', 'action_key_list'), Markup.button.callback('⏸️ Pause All', 'action_pause_all')],
        [Markup.button.callback('◀️ Back to Menu', 'menu_home')]
      ])
    );
  });

  bot.action('action_key_list', adminMiddleware, async (ctx: any) => {
    const licenses = await db.licenseKey.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    let message = '🔑 Recent Licenses:\n\n';
    for (const l of licenses) {
      message += `• ${l.keyIdentifier} [${l.status}]\n`;
    }
    await ctx.editMessageText(message, Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', 'menu_licenses')]]));
  });

  bot.action('action_pause_all', adminMiddleware, async (ctx: any) => {
    await ctx.editMessageText(
      `⚠️ CONFIRM ACTION\n\nYou are about to pause all active licenses.\nTheir remaining validity will be frozen until resumed.\n\nContinue?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Confirm', 'confirm_pause_all'), Markup.button.callback('Cancel', 'menu_licenses')]
      ])
    );
  });

  bot.action('confirm_pause_all', adminMiddleware, async (ctx: any) => {
    await LicenseService.pauseAll(getAdminId(ctx));
    await ctx.editMessageText('✓ All active licenses have been paused.', Markup.inlineKeyboard([[Markup.button.callback('◀️ Back', 'menu_licenses')]]));
  });

  bot.action('menu_resources', adminMiddleware, (ctx: any) => {
    ctx.editMessageText(
      `📦 ZROK RESOURCES\n\nResource server status: ● OPERATIONAL\nManaged via ZROK Control Panel.`,
      Markup.inlineKeyboard([[Markup.button.callback('◀️ Back to Menu', 'menu_home')]])
    );
  });

  bot.action('menu_devices', adminMiddleware, async (ctx: any) => {
    const count = await db.device.count();
    ctx.editMessageText(
      `📱 ZROK DEVICES\n\nTotal linked devices: ${count}\nStatus: Synchronized`,
      Markup.inlineKeyboard([[Markup.button.callback('◀️ Back to Menu', 'menu_home')]])
    );
  });

  bot.action('menu_analytics', adminMiddleware, async (ctx: any) => {
    const keysCount = await db.licenseKey.count();
    const activeCount = await db.licenseKey.count({ where: { status: LicenseStatus.ACTIVE } });
    const devicesCount = await db.device.count();
    ctx.editMessageText(
      `📊 ZROK ANALYTICS\n\n• Total Keys: ${keysCount}\n• Active Keys: ${activeCount}\n• Linked Devices: ${devicesCount}`,
      Markup.inlineKeyboard([[Markup.button.callback('◀️ Back to Menu', 'menu_home')]])
    );
  });

  bot.action('menu_activity', adminMiddleware, async (ctx: any) => {
    const logs = await db.auditLog.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
    let msg = `📜 RECENT ACTIVITY:\n\n`;
    for (const log of logs) {
      msg += `• [${log.action}] (${log.createdAt.toLocaleTimeString()})\n`;
    }
    ctx.editMessageText(msg, Markup.inlineKeyboard([[Markup.button.callback('◀️ Back to Menu', 'menu_home')]]));
  });

  bot.action('menu_system', adminMiddleware, (ctx: any) => {
    ctx.editMessageText(
      `⚙️ ZROK SYSTEM\n\nVersion: 1.0.0\nCore: ZROK Core\nEnvironment: Production`,
      Markup.inlineKeyboard([[Markup.button.callback('◀️ Back to Menu', 'menu_home')]])
    );
  });

  bot.command('key_create', adminMiddleware, async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('Usage: /key_create <days> [maxDevices]');
    
    const days = parseInt(args[1]);
    const maxDevices = args[2] ? parseInt(args[2]) : 1;
    
    try {
        const { keyIdentifier, rawSecret } = await LicenseService.createLicense(days, maxDevices, 'Created via Telegram', getAdminId(ctx));
        ctx.reply(`✓ ZROK License Created:\nID: ${keyIdentifier}\nSecret: ${rawSecret}`);
    } catch (e: any) {
        ctx.reply(`Error: ${e.message}`);
    }
  });

  bot.command('key_list', adminMiddleware, async (ctx) => {
      const licenses = await db.licenseKey.findMany({ take: 20, orderBy: { createdAt: 'desc' } });
      let message = 'ZROK Licenses (ID - Status):\n';
      for (const l of licenses) {
          message += `${l.keyIdentifier} - ${l.status}\n`;
      }
      ctx.reply(message || 'No licenses found');
  });

  bot.command('key_info', adminMiddleware, async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) return ctx.reply('Usage: /key_info <keyIdentifier>');
      
      const lic = await db.licenseKey.findUnique({ where: { keyIdentifier: args[1] }, include: { devices: true } });
      if (!lic) return ctx.reply('License not found');
      
      ctx.reply(`
ZROK License Info:
ID: ${lic.keyIdentifier}
Status: ${lic.status}
Paused: ${lic.pausedIndividual || lic.pausedGlobal ? 'YES' : 'NO'}
Expires: ${lic.expiresAt?.toISOString() || 'N/A (Not activated)'}
Devices: ${lic.devices.length}/${lic.maxDevices}
      `);
  });

  bot.command('key_pause', adminMiddleware, async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) return ctx.reply('Usage: /key_pause <keyIdentifier>');
      
      const lic = await db.licenseKey.findUnique({ where: { keyIdentifier: args[1] } });
      if (!lic) return ctx.reply('License not found');
      
      await LicenseService.pauseIndividual(lic.id, getAdminId(ctx));
      ctx.reply(`✓ License ${lic.keyIdentifier} paused. Validity frozen.`);
  });

  bot.command('key_resume', adminMiddleware, async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) return ctx.reply('Usage: /key_resume <keyIdentifier>');
      
      const lic = await db.licenseKey.findUnique({ where: { keyIdentifier: args[1] } });
      if (!lic) return ctx.reply('License not found');
      
      await LicenseService.resumeIndividual(lic.id, getAdminId(ctx));
      ctx.reply(`✓ License ${lic.keyIdentifier} resumed.`);
  });

  bot.command('key_revoke', adminMiddleware, async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) return ctx.reply('Usage: /key_revoke <keyIdentifier>');
      
      const lic = await db.licenseKey.findUnique({ where: { keyIdentifier: args[1] } });
      if (!lic) return ctx.reply('License not found');
      
      ctx.reply(`Confirm revoke for ${args[1]}?`, Markup.inlineKeyboard([
          Markup.button.callback('Yes, Revoke', `revoke_${lic.id}`),
          Markup.button.callback('Cancel', 'cancel')
      ]));
  });

  bot.action(/^revoke_(.+)$/, adminMiddleware, async (ctx: any) => {
      await LicenseService.revoke(ctx.match[1], getAdminId(ctx));
      ctx.editMessageText('✓ License revoked successfully.');
  });

  bot.command('keys_pause_all', adminMiddleware, async (ctx) => {
      ctx.reply('Confirm pause ALL active licenses?', Markup.inlineKeyboard([
          Markup.button.callback('Confirm Pause All', 'pause_all'),
          Markup.button.callback('Cancel', 'cancel')
      ]));
  });

  bot.action('pause_all', adminMiddleware, async (ctx: any) => {
      await LicenseService.pauseAll(getAdminId(ctx));
      ctx.editMessageText('✓ All licenses paused successfully.');
  });

  bot.command('keys_resume_all', adminMiddleware, async (ctx) => {
      ctx.reply('Confirm resume ALL paused licenses?', Markup.inlineKeyboard([
          Markup.button.callback('Confirm Resume All', 'resume_all'),
          Markup.button.callback('Cancel', 'cancel')
      ]));
  });

  bot.action('resume_all', adminMiddleware, async (ctx: any) => {
      await LicenseService.resumeAll(getAdminId(ctx));
      ctx.editMessageText('✓ All licenses resumed successfully.');
  });

  bot.action('cancel', (ctx: any) => ctx.editMessageText('Action cancelled.'));

  bot.launch();
  console.log('ZROK Control Bot started');
  return bot;
};
