import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { TasksService } from '../services/tasks.service';
import { CreateTaskDto, UpdateTaskDto, CreateCommentDto, TaskResponseDto, CommentResponseDto, PaginatedTaskResponseDto } from '../dto/tasks.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Tasks')
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new task under a project' })
  @ApiResponse({ status: 201, description: 'Task created.', type: TaskResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard)
  @Post('projects/:projectId/tasks')
  create(@Param('projectId') projectId: string, @Request() req: any, @Body() dto: CreateTaskDto) {
    const userId = req.user.sub || req.user.id;
    return this.tasksService.create(projectId, userId, dto);
  }

  @ApiOperation({ summary: 'Get all tasks by project ID' })
  @ApiResponse({ status: 200, description: 'List of tasks.', type: PaginatedTaskResponseDto })
  @Get('projects/:projectId/tasks')
  findAllByProject(@Param('projectId') projectId: string, @Query() query: PaginationQueryDto) {
    return this.tasksService.findAllByProject(projectId, query.page || 1, query.limit || 50);
  }

  @ApiOperation({ summary: 'Get public tasks looking for assignees' })
  @ApiResponse({ status: 200, description: 'List of public tasks.', type: PaginatedTaskResponseDto })
  @Get('tasks/public')
  getPublicTasks(@Query() query: PaginationQueryDto) {
    return this.tasksService.getPublicTasks(query.page || 1, query.limit || 50);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tasks assigned to me' })
  @ApiResponse({ status: 200, description: 'List of joined tasks.', type: PaginatedTaskResponseDto })
  @UseGuards(AuthGuard)
  @Get('tasks/joined')
  getJoinedTasks(@Request() req: any, @Query() query: PaginationQueryDto) {
    const userId = req.user.sub || req.user.id;
    return this.tasksService.getJoinedTasks(userId, query.page || 1, query.limit || 50);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated.', type: TaskResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @UseGuards(AuthGuard)
  @Put('tasks/:id')
  update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateTaskDto) {
    const userId = req.user.sub || req.user.id;
    return this.tasksService.update(id, userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiResponse({ status: 201, description: 'Comment added.', type: CommentResponseDto })
  @UseGuards(AuthGuard)
  @Post('tasks/:id/comments')
  addComment(@Param('id') id: string, @Request() req: any, @Body() dto: CreateCommentDto) {
    const userId = req.user.sub || req.user.id;
    return this.tasksService.addComment(id, userId, dto);
  }

  @ApiOperation({ summary: 'Get comments for a task' })
  @ApiResponse({ status: 200, description: 'List of comments.' })
  @Get('tasks/:id/comments')
  getComments(@Param('id') id: string) {
    return this.tasksService.getComments(id);
  }
}
