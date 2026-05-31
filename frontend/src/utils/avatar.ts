export const getAvatarUrl = (name: string, size = 128): string => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111111&color=f5c12d&size=${size}`;
};
