import tinify from "tinify"
import dotenv from 'dotenv'
dotenv.config()

const {TINIFY_API_KEY} = process.env

tinify.key = TINIFY_API_KEY!;

export default tinify