import app from "./src/app.ts";
import { connectDB } from "./src/config/database.ts";

const PORT = process.env.PORT || 3000;

connectDB()
.then(() => {
    app.listen(PORT, () => {
        console.log("Server is running on PORT:", PORT);
    });
})
.catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
} )
