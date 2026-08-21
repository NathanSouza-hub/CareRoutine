function createAttachProfile(caregiverProfilesRepository) {
  return async function attachProfile(request, response, next) {
    try {
      const header = request.headers["x-profile-id"];
      if (!header) {
        request.profileId = null;
        return next();
      }
      if (!/^\d+$/.test(header)) {
        return response.status(400).json({ error: "Perfil inválido" });
      }
      if (!(await caregiverProfilesRepository.belongsToUser(header, request.userId))) {
        return response.status(400).json({ error: "Perfil inválido" });
      }
      request.profileId = header;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = createAttachProfile;
