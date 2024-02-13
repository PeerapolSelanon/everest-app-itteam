const { Client } = require('pg')
const axios = require('axios')
const cron = require('node-cron')

console.log('line_notify Start')
// กำหนดค่าเชื่อมต่อ PostgreSQL
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'db_everestth',
  password: 'everest@123',
  port: 5432
})
// กำหนด Line Notify Token
const LINE_NOTIFY_TOKEN = 'Cpx036Yy5A87mhY7R9k9xig9zyGMIpcGfbvzroZZXZj'

const emoji = {
  meeting: '🖥️',
  time: '⏰',
  detail: '📝'
}

// ฟังก์ชันสำหรับส่งข้อความแจ้งเตือนผ่าน Line Notify API
async function sendLineNotify(message) {
  try {
    const response = await axios.post(
      'https://notify-api.line.me/api/notify',
      { message },
      {
        headers: {
          Authorization: `Bearer ${LINE_NOTIFY_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )
    console.log('Line Notify response:', response.data)
  } catch (error) {
    console.error('Error sending Line Notify:', error.message)
  }
}

// เชื่อมต่อกับฐานข้อมูล PostgreSQL
client.connect()

// ตั้งค่าการทำงานตามเวลาโดยใช้ cron job เพื่อตรวจสอบและส่งข้อความแจ้งเตือนเวลาประชุมที่ใกล้เข้ามา
cron.schedule('*/1 * * * *', async () => {
    // เช็คทุกๆ 1 นาที
    try {
      const query = `
        SELECT *
        FROM meetings
        WHERE time_start BETWEEN CURRENT_TIME AND CURRENT_TIME + INTERVAL '30 minutes'
        AND date = CURRENT_DATE
        AND status = 'false'
      `
      const result = await client.query(query)
      const meetings = result.rows
  
      if (meetings.length <= 0) {
        return console.log('ไม่มีประชุมตอนนี้')
      }
  
      // ส่งข้อความแจ้งเตือนสำหรับแต่ละประชุม
      meetings.forEach(async (meeting) => {
        const currentTime = new Date()
        const formattedcurrentTime = currentTime.toLocaleTimeString('en-US', { hour12: false })
        const [hour1, minute1, second1] = formattedcurrentTime.split(':')
        const countsecound1 = parseInt(hour1) * 60 * 60 + parseInt(minute1) * 60 + parseInt(second1)
        const [hour2, minute2, second2] = meeting.time_start.split(':')
        const countsecound2 = parseInt(hour2) * 60 * 60 + parseInt(minute2) * 60 + parseInt(second2)
  
        const timeDiff = countsecound2 - countsecound1 // หาความแตกต่างของเวลา
        const minutesLeft = Math.floor(parseInt(timeDiff) / 60) //ทำนาที
  
        let message = `
เหลือเวลาอีก ${minutesLeft} นาที
${emoji.meeting} ประชุม: ${meeting.head}
${emoji.meeting} ห้อง: ${meeting.room}
${emoji.time} เวลา: ${meeting.time_start.split(':')[0]}:${meeting.time_start.split(':')[1]}
${emoji.detail} รายละเอียด: ${meeting.detail}
ลิงค์: ${meeting.url}
        `        
  
        await sendLineNotify(message)
        
        const updateQuery = `
          UPDATE meetings
          SET status = 'true'
          WHERE id = $1;
        `
        await client.query(updateQuery, [meeting.id])
        console.log('Successfully updated status meetings')
      })
    } catch (error) {
      console.error('Error fetching or sending data:', error.message)
    }
  })
  

// ทำให้โปรแกรมทำงานตลอดเวลา
process.stdin.resume()
