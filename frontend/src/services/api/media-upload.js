import api from './client';

export const uploadAPI = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    // 不手动设 Content-Type，让浏览器自动添加 boundary
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': undefined },
    });
  },

  uploadVideo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/video', formData, {
      headers: { 'Content-Type': undefined },
    });
  },
};

export const uploadImage = (file) => uploadAPI.uploadImage(file);
export const uploadVideo = (file) => uploadAPI.uploadVideo(file);
