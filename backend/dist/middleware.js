"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"] || " ";
    try {
        const decoded = jsonwebtoken_1.default.verify(authHeader, process.env.JWT_SECRET || " ");
        //@ts-ignore
        if (decoded.userId) {
            //@ts-ignore
            req.userId = decoded.userId;
            return next();
        }
        else {
            res.status(401).json({
                msg: "Auth error"
            });
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            msg: "Auth error"
        });
    }
}
exports.authMiddleware = authMiddleware;
