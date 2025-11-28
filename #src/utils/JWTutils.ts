import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export class JWT {

    static secret = (process.env.JWT_SECRET as string) || "12345";

    static create(payload: any) {
        return jwt.sign(
            { payload },
            this.secret,
            { expiresIn: "2d" } // Токен действителен 2 дня
        );
    }

    static verify(token: string) {
        return new Promise((resolve, reject) => {
            jwt.verify(token, this.secret, (err, decoded) => {
                if (err) reject(err)
                    else resolve(decoded)
            });
        });
    }
}
