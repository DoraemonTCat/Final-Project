import express from 'express';

const app = express();
const PORT = 8003;

app.get('/', (req, res) => {
  res.send('Hello from port 8003!');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
