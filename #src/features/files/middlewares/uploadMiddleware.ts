import { authenticateJWT } from '../../../middlewares/common/authMiddleware'
import { uploadFilesMiddlewares } from './uploadFilesMiddlewares'

export const uploadMiddleware = [
    authenticateJWT(true),
    uploadFilesMiddlewares
]
