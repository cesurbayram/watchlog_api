import express from "express";
const app = express();
const port = process.env.PORT ?? "3001";

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello d!");
  console.log("Response send");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
