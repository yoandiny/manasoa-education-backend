import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: "yotechadmin",
  password: "YoTech25@",
  host: "193.180.213.193",
  port: 1552,
  database: "manasoa",
});

export default pool;
