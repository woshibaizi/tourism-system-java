import api from './client';
import { successResult, getApiFileUrl } from './normalize';
import { uploadAPI } from './media-upload';

export const aigcAPI = {
  uploadImage: async (file) => {
    const response = await uploadAPI.uploadImage(file);
    if (!response.success) {
      return response;
    }
    return successResult({
      ...response.data,
      url: getApiFileUrl(response.data?.path),
    }, response.message);
  },

  convertToAnimation: async ({
    imagePaths,
    description,
    outputFormat = 'gif',
    fps = 6,
    width = 848,
    height = 480,
  }) => {
    const response = await api.post('/aigc/convert-to-video', {
      imagePaths,
      description,
      outputFormat,
      fps,
      width,
      height,
    });

    if (!response.success) {
      return response;
    }

    const videoPath = response.data?.videoPath || response.data?.path || response.data?.outputPath;
    return successResult({
      ...response.data,
      videoPath,
      videoUrl: getApiFileUrl(videoPath),
      outputFormat,
    }, response.message);
  },
};

export const uploadAigcImage = (file) => aigcAPI.uploadImage(file);
export const convertImagesToAnimation = (payload) => aigcAPI.convertToAnimation(payload);
