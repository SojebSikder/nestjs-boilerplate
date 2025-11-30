// external imports
import { Command, CommandRunner } from 'nest-commander';
// internal imports
import appConfig from '../config/app.config';
import { StringHelper } from '../common/helper/string.helper';
import { UserRepository } from '../common/repository/user/user.repository';
import { PrismaService } from '../prisma/prisma.service';

@Command({ name: 'seed', description: 'prisma db seed' })
export class SeedCommand extends CommandRunner {
  constructor(private readonly prisma: PrismaService, private readonly userRepository: UserRepository) {
    super();
  }
  async run(passedParam: string[]): Promise<void> {
    await this.seed(passedParam);
  }

  async seed(param: string[]) {
    try {
      console.log(`Prisma Env: ${process.env.PRISMA_ENV}`);
      console.log('Seeding started...');

      // begin transaaction
      await this.prisma.$transaction(async ($tx) => {
        await this.roleSeed();
        await this.permissionSeed();
        await this.userSeed();
        await this.permissionRoleSeed();
      });

      console.log('Seeding done.');
    } catch (error) {
      throw error;
    }
  }

  //---- user section ----
  async userSeed() {
    // system admin, user id: 1
    const systemUser = await this.userRepository.createSuAdminUser({
      username: appConfig().defaultUser.system.username,
      email: appConfig().defaultUser.system.email,
      password: appConfig().defaultUser.system.password,
    });

    await this.prisma.roleUser.create({
      data: {
        user_id: systemUser.id,
        role_id: '1',
      },
    });
  }

  async permissionSeed() {
    let i = 0;
    const permissions = [];
    const permissionGroups = [
      // (system level )super admin level permission
      { title: 'system_tenant_management', subject: 'SystemTenant' },
      // end (system level )super admin level permission
      { title: 'user_management', subject: 'User' },
      { title: 'role_management', subject: 'Role' },
      // Project
      { title: 'Project', subject: 'Project' },
      // Task
      {
        title: 'Task',
        subject: 'Task',
        scope: ['read', 'create', 'update', 'show', 'delete', 'assign'],
      },
      // Comment
      { title: 'Comment', subject: 'Comment' },
    ];

    for (const permissionGroup of permissionGroups) {
      if (permissionGroup['scope']) {
        for (const permission of permissionGroup['scope']) {
          permissions.push({
            id: String(++i),
            title: permissionGroup.title + '_' + permission,
            action: StringHelper.cfirst(permission),
            subject: permissionGroup.subject,
          });
        }
      } else {
        for (const permission of [
          'read',
          'create',
          'update',
          'show',
          'delete',
        ]) {
          permissions.push({
            id: String(++i),
            title: permissionGroup.title + '_' + permission,
            action: StringHelper.cfirst(permission),
            subject: permissionGroup.subject,
          });
        }
      }
    }

    await this.prisma.permission.createMany({
      data: permissions,
    });
  }

  async permissionRoleSeed() {
    const all_permissions = await this.prisma.permission.findMany();
    const su_admin_permissions = all_permissions.filter(function (permission) {
      return permission.title.substring(0, 25) == 'system_tenant_management_';
    });
    // const su_admin_permissions = all_permissions;

    // -----su admin permission---
    const adminPermissionRoleArray = [];
    for (const su_admin_permission of su_admin_permissions) {
      adminPermissionRoleArray.push({
        role_id: '1',
        permission_id: su_admin_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: adminPermissionRoleArray,
    });
    // -----------

    // ---admin---
    const project_admin_permissions = all_permissions.filter(
      function (permission) {
        return permission.title.substring(0, 25) != 'system_tenant_management_';
      },
    );

    const projectAdminPermissionRoleArray = [];
    for (const admin_permission of project_admin_permissions) {
      projectAdminPermissionRoleArray.push({
        role_id: '2',
        permission_id: admin_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: projectAdminPermissionRoleArray,
    });
    // -----------

    // ---project manager---
    const project_manager_permissions = all_permissions.filter(
      function (permission) {
        return (
          permission.title == 'project_read' ||
          permission.title == 'project_show' ||
          permission.title == 'project_update' ||
          permission.title.substring(0, 4) == 'Task' ||
          permission.title.substring(0, 7) == 'Comment'
        );
      },
    );

    const projectManagerPermissionRoleArray = [];
    for (const project_manager_permission of project_manager_permissions) {
      projectManagerPermissionRoleArray.push({
        role_id: '3',
        permission_id: project_manager_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: projectManagerPermissionRoleArray,
    });
    // -----------

    // ---member---
    const member_permissions = all_permissions.filter(function (permission) {
      return (
        permission.title == 'project_read' ||
        permission.title == 'project_show' ||
        permission.title == 'task_read' ||
        permission.title == 'task_show' ||
        permission.title == 'task_update' ||
        permission.title.substring(0, 7) == 'comment'
      );
    });

    const memberPermissionRoleArray = [];
    for (const project_manager_permission of member_permissions) {
      memberPermissionRoleArray.push({
        role_id: '4',
        permission_id: project_manager_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: memberPermissionRoleArray,
    });
    // -----------

    // ---viewer---
    const viewer_permissions = all_permissions.filter(function (permission) {
      return (
        permission.title == 'project_read' ||
        permission.title == 'project_show' ||
        permission.title == 'task_read' ||
        permission.title == 'comment_read'
      );
    });

    const viewerPermissionRoleArray = [];
    for (const viewer_permission of viewer_permissions) {
      viewerPermissionRoleArray.push({
        role_id: '5',
        permission_id: viewer_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: viewerPermissionRoleArray,
    });
    // -----------
  }

  async roleSeed() {
    await this.prisma.role.createMany({
      data: [
        // system role
        {
          id: '1',
          title: 'Super Admin', // system admin, do not assign to a tenant/user
          name: 'su_admin',
        },
        // organization role
        {
          id: '2',
          title: 'Admin',
          name: 'admin',
        },
        {
          id: '3',
          title: 'Project Manager',
          name: 'project_manager',
        },
        {
          id: '4',
          title: 'Member',
          name: 'member',
        },
        {
          id: '5',
          title: 'Viewer',
          name: 'viewer',
        },
      ],
    });
  }
}
