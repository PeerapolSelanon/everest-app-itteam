const cors = require('cors')
const express = require('express')
const pgp = require('pg-promise')()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const bcrypt = require('bcrypt')

const app = express()

app.use(express.json())
app.use(
  cors({
    credentials: true,
    origin: ['http://122.154.66.171', 'http://172.16.1.55', 'http://172.16.1.16:5173']
  })
)
app.use(cookieParser())
app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true
  })
)

const port = 8087
const secret = 'mysecret'
let conn = null

// function init connection PostgreSQL
const initPostgreSQL = async () => {
  try {
    conn = pgp({
      user: 'postgres',
      host: 'localhost',
      database: 'db_everestth',
      password: 'everest@123',
      port: 5432,
    })
    console.log('PostgreSQL connected')
  } catch (error) {
    console.error('PostgreSQL connection error:', error)
    process.exit(1) // Exit the application on connection error
  }
}

// ================================================================================
// login authen create cookie and session
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body

  try {
    const result = await conn.any('SELECT * FROM users WHERE username = $1', username)
    if (result.length === 0) {
      return res.status(400).send({ message: 'User not found' })
    }

    const user = result[0]

    const match = await bcrypt.compare(password, user.password)

    if (!match) {
      return res.status(400).send({ message: 'Invalid password' })
    }

    // Create a token with username and role
    const token = jwt.sign({ username: user.username, role: user.role }, secret, {
      expiresIn: '1h'
    }) // server expires in 1 hour
    res.cookie('token', token, {
      maxAge: 1800000, //cookie expire 30 min
      httpOnly: true
      // secure: true, // for https
      // sameSite: 'None' // for https
    })

    req.session.userId = user.id
    console.log('save session', req.session.userId)

    res.send({ message: 'Login successful', token, role: user.role})
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})
// function authenticateToken
const authenticateToken = (req, res, next) => {
  // const authHeader = req.headers['authorization']
  // const token = authHeader && authHeader.split(' ')[1]
  const token = req.cookies.token
  console.log('session', req.session.userId)

  // if there isn't any token
  if (token == null) return res.sendStatus(401) 

  try {
    const user = jwt.verify(token, secret)
    req.user = user
    console.log('user', user)
    next()
  } catch (error) {
    return res.sendStatus(403)
  }
}
// API endpoint to check authentication token
app.get('/api/userprofile', authenticateToken, (req, res) => {
  const token = req.cookies.token
  if (token == null) return res.sendStatus(401) // if there isn't any token

  try {
    const user = jwt.verify(token, secret)
    res.json({ message: 'Token Is Ok', username: user.username, role: user.role })
  } catch (error) {
    return res.sendStatus(403)
  }
})

// ===============================================================================
// PostgreSQL Insert meeting Create endpoint
app.post('/api/meeting/create', authenticateToken, async (req, res) => {
  const data = req.body
  try {
    const timeStart = `${data.time[0].hours}:${data.time[0].minutes}:${data.time[0].seconds}`;
    const timeEnd = `${data.time[1].hours}:${data.time[1].minutes}:${data.time[1].seconds}`;
    
    await conn.query(
      'INSERT INTO meetings (head, time_start, time_end, room, url, detail, date, datecreate, status) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, false)',
      [
        data.head,
        timeStart,
        timeEnd,
        data.room,
        data.url,
        data.detail,
        data.date
      ]
    )
    res.json({ message: 'Data inserted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})
// PostgreSQL Select meetings Query endpoint
app.get('/api/meetings', async (req, res) => {
  try {
    const meetings = await conn.query("SELECT id, head, room, url, detail, time_start, time_end, to_char(date, 'YYYY-MM-DD') AS date FROM meetings");
    res.json({ meetings });
  } catch (error) {
    console.error(`Error fetching meetings: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ===============================================================================
// PostgreSQL Select oldpallet  Query endpoint
app.post('/api/oldpallet/select', authenticateToken, async (req, res) => {
  const { searchOldLocation } = req.body

  if (![searchOldLocation].some((param) => param !== undefined && param !== '' && param !== null)) {
    return res.json({ data: [], message: 'reset' })
  }
  let query = 'SELECT fabric_location FROM fabrics WHERE 1=1'
  let groupby = 'GROUP BY fabric_location'
  const params = []

  if (searchOldLocation) {
    const wildcardLocation = searchOldLocation === '*' ? '%' : searchOldLocation
    query += ` AND fabric_location LIKE $${params.length + 1}`
    params.push(wildcardLocation)
  }
  try {
    const results = await conn.query(query + ' ' + groupby, params)
    const oldfabricData = results.map((row, index) => ({
      fabric_id: index + 1,
      fabric_location: row.fabric_location
    }))
    res.json({ data: oldfabricData, message: 'Data search successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})
// PostgreSQL Select oldfabric Query endpoint
app.post('/api/oldfabric/select', authenticateToken, async (req, res) => {
  const {
    searchOldId,
    searchOldOrder,
    searchOldFinclose,
    searchOldColor,
    searchOldBatch,
    searchOldRoll,
    searchOldYard,
    searchOldGrade,
    searchOldLocation
  } = req.body

  if (
    ![
      searchOldId,
      searchOldOrder,
      searchOldFinclose,
      searchOldColor,
      searchOldBatch,
      searchOldRoll,
      searchOldYard,
      searchOldGrade,
      searchOldLocation
    ].some((param) => param !== undefined && param !== '' && param !== null)
  ) {
    return res.json({ data: [], message: 'reset' })
  }

  let query =
    "SELECT *, to_char(fabric_createdate, 'DD/MM/YYYY') as formatted_createdate, to_char(fabric_updatedate, 'DD/MM/YYYY') as formatted_updatedate FROM fabrics WHERE 1=1"

  const params = []

  if (searchOldId) {
    query += ` AND fabric_id = $${params.length + 1}`
    params.push(searchOldId)
  }
  if (searchOldOrder) {
    const wildcardOrder = searchOldOrder.replace('*', '%')
    query += ` AND fabric_order LIKE $${params.length + 1}`
    params.push(wildcardOrder)
  }
  if (searchOldFinclose) {
    query += ` AND fabric_finclose = $${params.length + 1}`
    params.push(searchOldFinclose)
  }
  if (searchOldColor) {
    query += ` AND fabric_color = $${params.length + 1}`
    params.push(searchOldColor)
  }
  if (searchOldBatch) {
    query += ` AND fabric_batch = $${params.length + 1}`
    params.push(searchOldBatch)
  }
  if (searchOldRoll) {
    query += ` AND fabric_roll = $${params.length + 1}`
    params.push(searchOldRoll)
  }
  if (searchOldYard) {
    query += ` AND fabric_yard = $${params.length + 1}`
    params.push(searchOldYard)
  }
  if (searchOldGrade) {
    query += ` AND fabric_grade = $${params.length + 1}`
    params.push(searchOldGrade)
  }
  if (searchOldLocation) {
    const wildcardLocation = searchOldLocation.replace('*', '%')
    query += ` AND fabric_location LIKE $${params.length + 1}`
    params.push(wildcardLocation)
  }
  try {
    const results = await conn.query(query, params)
    const oldfabricData = results.map((row) => ({
      fabric_id: row.fabric_id,
      fabric_order: row.fabric_order,
      fabric_finclose: row.fabric_finclose,
      fabric_color: row.fabric_color,
      fabric_batch: row.fabric_batch,
      fabric_roll: row.fabric_roll,
      fabric_yard: row.fabric_yard,
      fabric_grade: row.fabric_grade,
      fabric_location: row.fabric_location,
      fabric_updatedate: row.formatted_updatedate,
      fabric_createdate: row.formatted_createdate
    }))
    res.json({ data: oldfabricData, message: 'Data search successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})
// PostgreSQL Insert oldfabric Create endpoint
app.post('/api/oldfabric/create', authenticateToken, async (req, res) => {
  const data = req.body
  try {
    const result = await conn.query(
      'SELECT * FROM fabrics WHERE fabric_order = $1 AND fabric_finclose = $2 AND fabric_color = $3 AND fabric_batch = $4 AND fabric_roll = $5',
      [
        data.createOldOrder,
        data.createOldFinclose,
        data.createOldColor,
        data.createOldBatch,
        data.createOldRoll
      ]
    )
    if (result.length > 0) {
      return res.json({ error: 'Duplicate Data' })
    }
    await conn.query(
      'INSERT INTO fabrics (fabric_order, fabric_finclose, fabric_color, fabric_batch, fabric_roll, fabric_yard, fabric_grade, fabric_location, fabric_createdate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)',
      [
        data.createOldOrder,
        data.createOldFinclose,
        data.createOldColor,
        data.createOldBatch,
        data.createOldRoll,
        data.createOldYard,
        data.createOldGrade,
        data.createOldLocation
      ]
    )
    res.json({ message: 'Data inserted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})
// PostgreSQL Update oldfabric Update endpoint
app.put('/api/oldfabric/update/:id', authenticateToken, async (req, res) => {
  const fabricId = req.params.id
  try {
    const data = req.body
    const result = await conn.query(
      'SELECT * FROM fabrics WHERE fabric_order = $1 AND fabric_finclose = $2 AND fabric_color = $3 AND fabric_batch = $4 AND fabric_roll = $5',
      [
        data.fabric_order,
        data.fabric_finclose,
        data.fabric_color,
        data.fabric_batch,
        data.fabric_roll
      ]
    )

    if (result.length > 0) {
      return res.json({ message: 'Duplicate Data' })
    }
    await conn.query(
      'UPDATE fabrics SET fabric_order = $1, fabric_finclose = $2, fabric_color = $3, fabric_batch = $4, fabric_roll = $5, fabric_yard = $6, fabric_grade = $7, fabric_location = $8, fabric_updatedate = CURRENT_DATE WHERE fabric_id = $9',
      [
        data.fabric_order,
        data.fabric_finclose,
        data.fabric_color,
        data.fabric_batch,
        data.fabric_roll,
        data.fabric_yard,
        data.fabric_grade,
        data.fabric_location,
        fabricId
      ]
    )
    res.json({ message: 'Data updated successfully' })
  } catch (error) {
    console.error(`Error updating data: ${error.message}`)
    res.status(500).json({ error: `Error updating data: ${error.message}` })
  }
})
// PostgreSQL Delete oldfabric Delete endpoint
app.delete('/api/oldfabric/delete/:id', authenticateToken, async (req, res) => {
  const fabricId = req.params.id
  try {
    const result = await conn.query('DELETE FROM fabrics WHERE fabric_id = $1', [fabricId])
    res.json({ message: 'Data deleted successfully' })
  } catch (error) {
    console.error(`Error deleting data: ${error.message}`)
    res.status(500).json({ error: `Error deleting data: ${error.message}` })
  }
})

// ================================================================================
// Listen
app.listen(port, '172.16.1.16', async () => {
  await initPostgreSQL()
  console.log('Server started at port 8087')
})
