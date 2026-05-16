import api from './client';

export const uploadAPI = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  uploadVideo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const uploadImage = (file) => uploadAPI.uploadImage(file);
export const uploadVideo = (file) => uploadAPI.uploadVideo(file);
