import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto, ProjectResponseDto, AssignRoleDto, ProjectMemberResponseDto, PaginatedProjectResponseDto } from '../dto/projects.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created.', type: ProjectResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard)
  @Post()
  create(@Request() req: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Get all projects' })
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
    return this.projectsService.getJoinedProjects(req.user.sub || req.user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get projects created by current user' })
  @ApiResponse({ status: 200, description: 'List of owned projects.' })
  @UseGuards(AuthGuard)
  @Get('owned')
  getOwnedProjects(@Request() req: any) {
    return this.projectsService.getOwnedProjects(req.user.sub || req.user.id);
  }

  @ApiOperation({ summary: 'Get a single project by ID' })
  @ApiResponse({ status: 200, description: 'Project details.', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a project' })
  @ApiResponse({ status: 200, description: 'Project updated.', type: ProjectResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your project' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @UseGuards(AuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Request() req: any, @Body() dto: Partial<CreateProjectDto>) {
    return this.projectsService.update(id, req.user.sub, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply for a project' })
  @ApiResponse({ status: 201, description: 'Application submitted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard)
  @Post(':id/applications')
  apply(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.apply(id, req.user.sub);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get applications for a project (Owner only)' })
  @ApiResponse({ status: 200, description: 'List of applications.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your project' })
  @UseGuards(AuthGuard)
  @Get(':id/applications')
  getApplications(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.getApplications(id, req.user.sub);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process an application (Owner only)' })
  @ApiResponse({ status: 200, description: 'Application processed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your project' })
  @UseGuards(AuthGuard)
  @Put(':id/applications/:appId')
  processApplication(
    @Param('id') id: string, 
    @Param('appId') appId: string, 
    @Request() req: any, 
    @Body('status') status: string
  ) {
    return this.projectsService.processApplication(id, appId, req.user.sub, status);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign a role to a project member' })
  @ApiResponse({ status: 201, description: 'Role assigned.', type: ProjectMemberResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only PM or Owner can assign roles' })
  @UseGuards(AuthGuard)
  @Post(':id/members')
  assignRole(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: AssignRoleDto
  ) {
    return this.projectsService.assignRole(id, dto.userId, dto.role, req.user.sub);
  }
}
