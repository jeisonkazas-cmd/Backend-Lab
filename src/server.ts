import app from "./app";

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Servidor backend corriendo en http://localhost:${port}`);
});
