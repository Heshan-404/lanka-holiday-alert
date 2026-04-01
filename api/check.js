require('dotenv').config();
const axios = require('axios');
const { DateTime } = require('luxon');

const CALENDARIFIC_URL = 'https://calendarific.com/api/v2/holidays';
const COUNTRY_CODE = 'LK';

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry strategy
async function withRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = Math.pow(2, i) * 1000;
      await wait(delay);
    }
  }
}

async function fetchHolidays(year, month) {
  const apiKey = process.env.CALENDARIFIC_API_KEY;
  if (!apiKey) throw new Error('CALENDARIFIC_API_KEY is missing');

  const response = await axios.get(CALENDARIFIC_URL, {
    params: {
      api_key: apiKey,
      country: COUNTRY_CODE,
      year: year,
      month: month
    }
  });

  if (response.data && response.data.response && response.data.response.holidays) {
    return response.data.response.holidays;
  }
  return [];
}

async function sendNotification(message) {
  const slackUrls = (process.env.SLACK_WEBHOOK_URL || '').split(',').map(s => s.trim()).filter(Boolean);
  const discordUrls = (process.env.DISCORD_WEBHOOK_URL || '').split(',').map(s => s.trim()).filter(Boolean);
  const isValidUrl = (url) => url && url.startsWith('http');

  for (const url of slackUrls) {
    if (isValidUrl(url)) {
      const slackMessage = message.replace(/\*\*(.*?)\*\*/g, '*$1*');
      await withRetry(() => axios.post(url, { text: slackMessage }));
    }
  }

  for (const url of discordUrls) {
    if (isValidUrl(url)) {
      try {
        await withRetry(() => axios.post(url, { content: message }));
      } catch (err) {
        console.error('Discord notification failed:', err.response ? JSON.stringify(err.response.data) : err.message);
      }
    }
  }
}

module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const today = DateTime.now().setZone('Asia/Colombo');
    
    // Configurations from Env with defaults
    const scheduledDay = parseInt(process.env.REPORT_SCHEDULE_DAY || '10');
    const allowedTypes = (process.env.HOLIDAY_TYPES || 'public holiday, national holiday')
      .split(',')
      .map(t => t.trim().toLowerCase());

    const isScheduledRun = (today.day + 9) === scheduledDay; // TEMPORARY FOR TESTING
    
    const targetDate = isScheduledRun ? today.plus({ months: 1 }) : today;
    const holidays = await withRetry(() => fetchHolidays(targetDate.year, targetDate.month));
    
    const filteredHolidays = holidays.filter(h => {
      // Filter based on allowed types from ENV
      const hasAllowedType = h.type && h.type.some(t => {
        const lowerT = t.toLowerCase();
        return allowedTypes.some(allowed => lowerT.includes(allowed));
      });
      if (!hasAllowedType) return false;

      if (!isScheduledRun) {
          const hDate = DateTime.fromISO(h.date.iso).setZone('Asia/Colombo');
          return hDate >= today.startOf('day');
      }
      return true;
    });

    if (filteredHolidays.length === 0) {
      return res.status(200).json({ status: `No upcoming public holidays found for ${targetDate.monthLong}.` });
    }

    filteredHolidays.sort((a, b) => a.date.iso.localeCompare(b.date.iso));

    let message = `**Public Holiday Alert – Sri Lanka** 🇱🇰\n`;
    message += `**${targetDate.monthLong} ${targetDate.year}**\n\n`;

    filteredHolidays.forEach((h, index) => {
      const hDate = DateTime.fromISO(h.date.iso).setZone('Asia/Colombo');
      const formattedDate = hDate.toFormat('cccc, d MMMM yyyy');
      const name = h.name.toLowerCase();
      
      let emoji = '🗓️';
      if (name.includes('poya')) emoji = '🟡';
      else if (name.includes('good friday') || name.includes('easter')) emoji = '✝️';
      else if (name.includes('new year\'s eve')) emoji = '🎊';
      else if (name.includes('new year\'s day')) emoji = '🎉';
      else if (name.includes('may day')) emoji = '🔨';
      else if (name.includes('eid') || name.includes('hadji') || name.includes('id-ul') || name.includes('milad')) emoji = '🕌';
      else if (name.includes('thai pongal')) emoji = '🍚';
      else if (name.includes('national day')) emoji = '🇱🇰';
      else if (name.includes('christmas')) emoji = '🎄';
      else if (name.includes('deepavali')) emoji = '🪔';
      else if (name.includes('sivarathri')) emoji = '🕉️';

      let description = h.description || 'Public holiday';
      if (name.includes('poya')) description = 'Public holiday (Poya Day)';
      else if (name.includes('may day')) description = 'Global Workers\' Day';
      else if (name.includes('good friday')) description = 'Christian observance before Easter Sunday';
      else if (name.includes('eid al-adha')) description = 'Islamic festival commemorating Ibrahim’s sacrifice';
      else if (name.includes('eid al-fitr')) description = 'Islamic festival marking the end of Ramadan';
      else if (name.includes('national day')) description = 'Sri Lanka Independence Day';
      else if (name.includes('christmas')) description = 'Christian celebration of the birth of Jesus';
      else if (name.includes('tamil new year')) description = 'National public holiday';

      message += `${emoji} **${h.name}**\n\n`;
      message += `${formattedDate}\n`; 
      message += `${description}\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });

    let reportMonth;
    let triggerMonth;
    if (today.day < scheduledDay) {
        reportMonth = today.plus({ months: 1 });
        triggerMonth = today;
    } else {
        reportMonth = today.plus({ months: 2 });
        triggerMonth = today.plus({ months: 1 });
    }
    
    // Updated Footer formatting
    message += `_${reportMonth.monthLong} month's report will be sent on ${triggerMonth.monthLong} ${scheduledDay}th_`;

    await sendNotification(message);
    res.status(200).json({ status: 'Report sent successfully.' });
  } catch (err) {
    console.error('Failed to generate holiday report:', err.message);
    res.status(500).json({ error: err.message });
  }
};
