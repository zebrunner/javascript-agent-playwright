"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertVideo = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = require("@ffmpeg-installer/ffmpeg");
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.path);
const convertVideo = async (path, format) => {
    try {
        return new Promise((resolve, reject) => {
            const fileName = path.replace('.webm', '');
            const convertedFilePath = `${fileName}.${format}`;
            (0, fluent_ffmpeg_1.default)(path)
                .toFormat(format)
                .outputOptions(['-vsync 2'])
                .saveToFile(convertedFilePath)
                .on('end', () => {
                resolve();
            })
                .on('error', (error) => {
                return reject(new Error(error));
            });
        });
    }
    catch (error) {
        console.log('Error during convertVideo:', error);
    }
};
exports.convertVideo = convertVideo;
//# sourceMappingURL=convertVideo.js.map