import { cacheMiddleware } from './cacheMiddleware'
import { existsFileMiddleware } from './existsFileMiddleware'

export const getFileMiddleware = [
    cacheMiddleware,
    existsFileMiddleware
]
