const { Pool } = require('pg');

const pool = new Pool({
  user: "yotechadmin",
  password: "YoTech25@",
  host: "193.180.213.193",
  port: 1552,
  database: "manasoa",
});

module.exports = pool;
