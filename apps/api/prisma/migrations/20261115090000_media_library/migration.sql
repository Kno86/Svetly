-- RBAC: media library (mirrors src/rbac/permissions.ts)
INSERT INTO "permissions" ("code", "description") VALUES
  ('media.manage', 'Медиатека: просмотр всех публичных фото, подписи, удаление неиспользуемых');
INSERT INTO "role_permissions" ("role_code", "permission_code") VALUES
  ('super_admin', 'media.manage'),
  ('admin', 'media.manage'),
  ('editor', 'media.manage');
