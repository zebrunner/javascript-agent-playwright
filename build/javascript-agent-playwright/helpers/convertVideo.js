"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertVideo = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const convertVideo = async (path, format) => {
    try {
        const fileName = path.replace('.webm', '');
        const convertedFilePath = `${fileName}.${format}`;
        await (0, fluent_ffmpeg_1.default)(path).toFormat(format).outputOptions(['-vsync 2']).saveToFile(convertedFilePath);
    }
    catch (error) {
        console.log('Error during convertVideo:', error);
    }
};
exports.convertVideo = convertVideo;
//# sourceMappingURL=convertVideo.js.map