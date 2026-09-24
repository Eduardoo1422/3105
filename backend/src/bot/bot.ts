import { Telegraf } from 'telegraf';
import { config } from '../config';
import { LicenseService } from '../services/license.service';

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
    ctx.reply('Unauthorized');
  };

  bot.command('start', (ctx) => ctx.reply('Swag-External Admin Bot'));
  
  bot.command('status', adminMiddleware, (ctx) => {
    ctx.reply('System operational');
  });

  bot.command('key_create', adminMiddleware, async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('Usage: /key_create <days> [maxDevices]');
    
    const days = parseInt(args[1]);
    const maxDevices = args[2] ? parseInt(args[2]) : 1;
    
    try {
        const { rawKey } = await LicenseService.createLicense(days, maxDevices, 'Created via Telegram');
        ctx.reply(`Key created: ${rawKey}`);
    } catch (e: any) {
        ctx.reply(`Error creating key: ${e.message}`);
    }
  });

  bot.launch();
  console.log('Telegram bot started');
  return bot;
};
