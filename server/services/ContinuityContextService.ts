import { Panel, Page, Project, PanelCharacterState } from "@shared/schema";
import { SharedStateManager } from "../parallel-processing/SharedStateManager";
import { IStorage } from "../storage";

export interface PanelContinuityContext {
  panel: Panel;
  page?: Page;
  project?: Project;
  characterStates: PanelCharacterState[];
  sharedContext?: any;
}

export class ContinuityContextService {
  constructor(
    private readonly storage: IStorage,
    private readonly sharedStateManager?: SharedStateManager,
  ) {}

  async buildPanelContext(panelId: string): Promise<PanelContinuityContext> {
    const panel = await this.storage.getPanel(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    const page = await this.storage.getPage(panel.pageId);
    const project = page ? await this.storage.getProject(page.projectId) : undefined;
    const characterStates = await this.storage.getPanelCharacterStates(panelId);

    let sharedContext: any | undefined;
    if (project && this.sharedStateManager) {
      try {
        sharedContext = await this.sharedStateManager.getSharedContext(project.id);
      } catch (error) {
        // Swallow shared state errors to avoid blocking job creation.
        console.warn(
          `ContinuityContextService: failed to load shared context for project ${project.id}:`,
          error,
        );
      }
    }

    return {
      panel,
      page: page ?? undefined,
      project: project ?? undefined,
      characterStates,
      sharedContext,
    };
  }
}
