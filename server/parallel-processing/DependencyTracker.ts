import EventEmitter from 'events';
import { ParallelGenerationTask } from './ParallelGenerationManager';

export interface DependencyNode {
  taskId: string;
  task: ParallelGenerationTask;
  dependencies: Set<string>; // Task IDs this depends on
  dependents: Set<string>; // Task IDs that depend on this
  status: 'waiting' | 'ready' | 'running' | 'completed' | 'failed';
  completedAt?: Date;
}

export interface DependencyGraph {
  sessionId: string;
  nodes: Map<string, DependencyNode>;
  readyTasks: Set<string>;
  completedTasks: Set<string>;
  failedTasks: Set<string>;
  createdAt: Date;
}

export class DependencyTracker extends EventEmitter {
  private graphs: Map<string, DependencyGraph> = new Map();

  buildDependencyGraph(tasks: ParallelGenerationTask[]): string {
    const sessionId = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const graph: DependencyGraph = {
      sessionId,
      nodes: new Map(),
      readyTasks: new Set(),
      completedTasks: new Set(),
      failedTasks: new Set(),
      createdAt: new Date()
    };

    // Create nodes for all tasks
    for (const task of tasks) {
      const node: DependencyNode = {
        taskId: task.id,
        task,
        dependencies: new Set(task.dependencies),
        dependents: new Set(),
        status: task.dependencies.length === 0 ? 'ready' : 'waiting'
      };
      graph.nodes.set(task.id, node);
    }

    // Build dependency relationships
    for (const [taskId, node] of graph.nodes) {
      for (const depId of node.dependencies) {
        const depNode = graph.nodes.get(depId);
        if (depNode) {
          depNode.dependents.add(taskId);
        } else {
          // Dependency not found - remove it
          node.dependencies.delete(depId);
          this.emit('dependencyNotFound', sessionId, taskId, depId);
        }
      }

      // If no dependencies after cleanup, mark as ready
      if (node.dependencies.size === 0 && node.status === 'waiting') {
        node.status = 'ready';
        graph.readyTasks.add(taskId);
      }
    }

    // Validate for circular dependencies
    this.validateNoCycles(graph);

    this.graphs.set(sessionId, graph);
    this.emit('graphBuilt', sessionId, graph);

    return sessionId;
  }

  private validateNoCycles(graph: DependencyGraph): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true; // Found a cycle
      }
      if (visited.has(nodeId)) {
        return false; // Already processed
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = graph.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.nodes.keys()) {
      if (hasCycle(nodeId)) {
        throw new Error(`Circular dependency detected in session ${graph.sessionId}`);
      }
    }
  }

  getReadyTasks(sessionId: string): ParallelGenerationTask[] {
    const graph = this.graphs.get(sessionId);
    if (!graph) {
      throw new Error(`Dependency graph not found: ${sessionId}`);
    }

    const readyTasks: ParallelGenerationTask[] = [];
    
    for (const taskId of graph.readyTasks) {
      const node = graph.nodes.get(taskId);
      if (node && node.status === 'ready') {
        readyTasks.push(node.task);
      }
    }

    return readyTasks;
  }

  markTaskRunning(sessionId: string, taskId: string): boolean {
    const graph = this.graphs.get(sessionId);
    if (!graph) {
      return false;
    }

    const node = graph.nodes.get(taskId);
    if (!node || node.status !== 'ready') {
      return false;
    }

    node.status = 'running';
    graph.readyTasks.delete(taskId);
    
    this.emit('taskStarted', sessionId, taskId);
    return true;
  }

  resolveTask(sessionId: string, taskId: string): ParallelGenerationTask[] {
    const graph = this.graphs.get(sessionId);
    if (!graph) {
      return [];
    }

    const node = graph.nodes.get(taskId);
    if (!node) {
      return [];
    }

    // Mark task as completed
    node.status = 'completed';
    node.completedAt = new Date();
    graph.completedTasks.add(taskId);

    // Check dependents to see if any become ready
    const newlyReadyTasks: ParallelGenerationTask[] = [];

    for (const dependentId of node.dependents) {
      const dependentNode = graph.nodes.get(dependentId);
      if (!dependentNode || dependentNode.status !== 'waiting') {
        continue;
      }

      // Remove this dependency
      dependentNode.dependencies.delete(taskId);

      // Check if all dependencies are resolved
      let allDependenciesCompleted = true;
      for (const depId of dependentNode.dependencies) {
        const depNode = graph.nodes.get(depId);
        if (!depNode || depNode.status !== 'completed') {
          allDependenciesCompleted = false;
          break;
        }
      }

      if (allDependenciesCompleted) {
        dependentNode.status = 'ready';
        graph.readyTasks.add(dependentId);
        newlyReadyTasks.push(dependentNode.task);
        this.emit('taskBecameReady', sessionId, dependentId);
      }
    }

    this.emit('taskCompleted', sessionId, taskId, newlyReadyTasks.length);
    return newlyReadyTasks;
  }

  failTask(sessionId: string, taskId: string): void {
    const graph = this.graphs.get(sessionId);
    if (!graph) {
      return;
    }

    const node = graph.nodes.get(taskId);
    if (!node) {
      return;
    }

    node.status = 'failed';
    graph.failedTasks.add(taskId);
    graph.readyTasks.delete(taskId);

    // Mark all dependent tasks as failed (cascade failure)
    this.cascadeFailure(graph, taskId);

    this.emit('taskFailed', sessionId, taskId);
  }

  private cascadeFailure(graph: DependencyGraph, failedTaskId: string): void {
    const failedNode = graph.nodes.get(failedTaskId);
    if (!failedNode) {
      return;
    }

    for (const dependentId of failedNode.dependents) {
      const dependentNode = graph.nodes.get(dependentId);
      if (dependentNode && dependentNode.status !== 'failed' && dependentNode.status !== 'completed') {
        dependentNode.status = 'failed';
        graph.failedTasks.add(dependentId);
        graph.readyTasks.delete(dependentId);
        
        // Recursively fail dependents
        this.cascadeFailure(graph, dependentId);
        
        this.emit('taskFailedCascade', graph.sessionId, dependentId, failedTaskId);
      }
    }
  }

  getDependencyStatus(sessionId: string): {
    totalTasks: number;
    readyTasks: number;
    runningTasks: number;
    completedTasks: number;
    failedTasks: number;
    waitingTasks: number;
  } {
    const graph = this.graphs.get(sessionId);
    if (!graph) {
      return {
        totalTasks: 0,
        readyTasks: 0,
        runningTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        waitingTasks: 0
      };
    }

    let readyCount = 0;
    let runningCount = 0;
    let waitingCount = 0;

    for (const node of graph.nodes.values()) {
      switch (node.status) {
        case 'ready':
          readyCount++;
          break;
        case 'running':
          runningCount++;
          break;
        case 'waiting':
          waitingCount++;
          break;
      }
    }

    return {
      totalTasks: graph.nodes.size,
      readyTasks: readyCount,
      runningTasks: runningCount,
      completedTasks: graph.completedTasks.size,
      failedTasks: graph.failedTasks.size,
      waitingTasks: waitingCount
    };
  }

  getTaskDependencies(sessionId: string, taskId: string): {
    dependencies: string[];
    dependents: string[];
    status: string;
  } | null {
    const graph = this.graphs.get(sessionId);
    if (!graph) {
      return null;
    }

    const node = graph.nodes.get(taskId);
    if (!node) {
      return null;
    }

    return {
      dependencies: Array.from(node.dependencies),
      dependents: Array.from(node.dependents),
      status: node.status
    };
  }

  visualizeDependencyGraph(sessionId: string): string {
    const graph = this.graphs.get(sessionId);
    if (!graph) {
      return 'Graph not found';
    }

    let visualization = `Dependency Graph for Session: ${sessionId}\n`;
    visualization += `Total Tasks: ${graph.nodes.size}\n`;
    visualization += `Ready: ${graph.readyTasks.size}, Completed: ${graph.completedTasks.size}, Failed: ${graph.failedTasks.size}\n\n`;

    for (const [taskId, node] of graph.nodes) {
      const depStr = Array.from(node.dependencies).join(', ') || 'none';
      const depntStr = Array.from(node.dependents).join(', ') || 'none';
      
      visualization += `Task: ${taskId} [${node.status}]\n`;
      visualization += `  Dependencies: ${depStr}\n`;
      visualization += `  Dependents: ${depntStr}\n`;
      visualization += `  Priority: ${node.task.priority}\n\n`;
    }

    return visualization;
  }

  cleanupSession(sessionId: string): boolean {
    const deleted = this.graphs.delete(sessionId);
    if (deleted) {
      this.emit('sessionCleaned', sessionId);
    }
    return deleted;
  }

  getAllSessions(): string[] {
    return Array.from(this.graphs.keys());
  }

  // Advanced dependency analysis
  getCriticalPath(sessionId: string): string[] {
    const graph = this.graphs.get(sessionId);
    if (!graph) {
      return [];
    }

    // Find the longest path through the dependency graph
    const longestPath: string[] = [];
    const visited = new Set<string>();

    const findLongestPath = (nodeId: string, currentPath: string[]): string[] => {
      if (visited.has(nodeId)) {
        return currentPath;
      }

      visited.add(nodeId);
      const node = graph.nodes.get(nodeId);
      if (!node) {
        return currentPath;
      }

      const pathWithCurrent = [...currentPath, nodeId];
      let longestFromHere = pathWithCurrent;

      for (const dependentId of node.dependents) {
        const pathThroughDependent = findLongestPath(dependentId, pathWithCurrent);
        if (pathThroughDependent.length > longestFromHere.length) {
          longestFromHere = pathThroughDependent;
        }
      }

      visited.delete(nodeId);
      return longestFromHere;
    };

    // Start from nodes with no dependencies
    for (const [nodeId, node] of graph.nodes) {
      if (node.dependencies.size === 0) {
        const pathFromRoot = findLongestPath(nodeId, []);
        if (pathFromRoot.length > longestPath.length) {
          longestPath.splice(0, longestPath.length, ...pathFromRoot);
        }
      }
    }

    return longestPath;
  }

  estimateCompletionTime(sessionId: string, averageTaskTimeMs: number): number {
    const criticalPath = this.getCriticalPath(sessionId);
    return criticalPath.length * averageTaskTimeMs;
  }
}