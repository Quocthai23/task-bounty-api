import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ProjectsService } from '../services/projects.service';
import { 
  CreateProjectDto, 
  UpdateProjectDto, 
  AddMemberByEmailDto, 
  UpdateMemberPermissionsDto, 
  RewardMemberDto, 
  ApplyProjectDto, 
  AssignRoleDto, 
  ProjectResponseDto, 
  ProjectMemberResponseDto, 
  PaginatedProjectResponseDto 
} from '../dto/projects.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new project / job' })
  @ApiResponse({ status: 201, description: 'Project created.' })
  @UseGuards(AuthGuard)
  @Post()
  create(@Request() req: any, @Body() dto: CreateProjectDto) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.create(userId, dto);
  }

  @ApiOperation({ summary: 'Get all public projects' })
  @ApiResponse({ status: 200, description: 'List of projects.', type: PaginatedProjectResponseDto })
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.projectsService.findAll(query.page || 1, query.limit || 10);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get projects joined by current user' })
  @ApiResponse({ status: 200, description: 'List of joined projects.' })
  @UseGuards(AuthGuard)
  @Get('joined')
  getJoinedProjects(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.getJoinedProjects(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get projects created or managed by current user (PM / Owner)' })
  @ApiResponse({ status: 200, description: 'List of managed projects.' })
  @UseGuards(AuthGuard)
  @Get('owned')
  getOwnedProjects(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.getOwnedProjects(userId);
  }

  @ApiOperation({ summary: 'Get a single project by ID' })
  @ApiResponse({ status: 200, description: 'Project details.' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a project (PM / Owner only - Budget locks if applicants exist)' })
  @ApiResponse({ status: 200, description: 'Project updated.' })
  @UseGuards(AuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateProjectDto) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.update(id, userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a project member directly by email (PM / Owner only)' })
  @ApiResponse({ status: 201, description: 'Member added.' })
  @UseGuards(AuthGuard)
  @Post(':id/members/email')
  addMemberByEmail(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: AddMemberByEmailDto
  ) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.addMemberByEmail(id, userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update member permissions (e.g. CAN_CREATE_TASK, CAN_MOVE_DONE)' })
  @ApiResponse({ status: 200, description: 'Permissions updated.' })
  @UseGuards(AuthGuard)
  @Put(':id/members/:memberId/permissions')
  updateMemberPermissions(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req: any,
    @Body() dto: UpdateMemberPermissionsDto
  ) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.updateMemberPermissions(id, memberId, userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reward standout member with instant bonus (PM / Owner only)' })
  @ApiResponse({ status: 200, description: 'Bonus granted.' })
  @UseGuards(AuthGuard)
  @Post(':id/members/:memberId/reward')
  rewardMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req: any,
    @Body() dto: RewardMemberDto
  ) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.rewardMember(id, memberId, userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply for a project' })
  @ApiResponse({ status: 201, description: 'Application submitted.' })
  @UseGuards(AuthGuard)
  @Post(':id/applications')
  apply(@Param('id') id: string, @Request() req: any, @Body() dto: ApplyProjectDto) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.apply(id, userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get applications with full applicant profiles (PM / Owner only)' })
  @ApiResponse({ status: 200, description: 'List of applications.' })
  @UseGuards(AuthGuard)
  @Get(':id/applications')
  getApplications(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.getApplications(id, userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process an application (APPROVE / REJECT) (PM / Owner only)' })
  @ApiResponse({ status: 200, description: 'Application processed.' })
  @UseGuards(AuthGuard)
  @Put(':id/applications/:appId')
  processApplication(
    @Param('id') id: string, 
    @Param('appId') appId: string, 
    @Request() req: any, 
    @Body('status') status: string
  ) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.processApplication(id, appId, userId, status);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign a role to a project member' })
  @ApiResponse({ status: 201, description: 'Role assigned.', type: ProjectMemberResponseDto })
  @UseGuards(AuthGuard)
  @Post(':id/members')
  assignRole(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: AssignRoleDto
  ) {
    const userId = req.user.sub || req.user.id;
    return this.projectsService.assignRole(id, dto.userId, dto.role, userId);
  }
}
