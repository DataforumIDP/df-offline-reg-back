import { Router, Request, Response, NextFunction } from 'express'
import { ProjectService } from '../services/projectService'
import { ProjectFieldService } from '../services/projectFieldService'
import {
    ParticipantService,
    ParticipantCodeService,
} from '../services/participantService'
import { participantLogService } from '../services/participantLogService'
import { scanExportService } from '../services/scanExportService'
import { printTemplateService } from '../services/printTemplateService'
import { webhookService } from '../services/webhookService'
import { scannersDAL } from '../dal/scannersDAL'
import { deviceJournalService } from '../services/deviceJournalService'
import {
    getJournalMiddlewares,
    getJournalStatsMiddlewares,
    returnJournalMiddlewares,
} from '../middlewares/projects/journalMiddlewares'
import { ScannerHelper } from '../models/scanners'
import { wrap } from '../utils/wrap'
import { dbError } from '../utils/errors'
import { createMiddlewares } from '../middlewares/projects/createMiddlewares'
import { updateMiddlewares } from '../middlewares/projects/updateMiddlewares'
import { deleteMiddlewares } from '../middlewares/projects/deleteMiddlewares'
import { getMiddlewares } from '../middlewares/projects/getMiddlewares'
import { getOneMiddlewares } from '../middlewares/projects/getOneMiddlewares'
import {
    getSchemeMiddlewares,
    createFieldMiddlewares,
    updateFieldMiddlewares,
    deleteFieldMiddlewares,
} from '../middlewares/projects/schemeMiddlewares'
import {
    getParticipantsMiddlewares,
    getParticipantMiddlewares,
    createParticipantMiddlewares,
    updateParticipantMiddlewares,
    deleteParticipantMiddlewares,
    deleteParticipantsBulkMiddlewares,
    getLogsMiddlewares,
    printParticipantMiddlewares,
    excelTemplateMiddlewares,
    excelImportMiddlewares,
    excelExportMiddlewares,
    clearParticipantsMiddlewares,
    clearPrintMarksMiddlewares,
    clearScannerLogsMiddlewares,
    exportScansMiddlewares,
    exportMassScansMiddlewares,
    findByCodeMiddlewares,
} from '../middlewares/projects/participantMiddlewares'
import {
    assignTemplateMiddlewares,
    removeTemplateMiddlewares,
    getProjectTemplateMiddlewares,
} from '../middlewares/printTemplateMiddlewares'
import { projectScriptsService } from '../services/projectScriptsService'
import { roleCheck } from '../middlewares/common/roleCaheck'
import { adminRoles } from '../datas/rolesData'

export const projectsRouter = Router()

const requireAdminForRuntimeScriptUpdate = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (req.body?.runtimeScript === undefined) {
        return next()
    }
    return roleCheck(adminRoles)(req, res, next)
}

const project = new ProjectService()
const projectField = new ProjectFieldService()
const participant = new ParticipantService()
const participantCode = new ParticipantCodeService()

// ===== Роуты проектов =====
projectsRouter.post('/', createMiddlewares, project.create)
projectsRouter.patch('/:id', updateMiddlewares, project.update)
projectsRouter.get('/', getMiddlewares, project.get)
projectsRouter.get('/:id/users', getMiddlewares, project.getUsers)
projectsRouter.get('/:slugOrId', getOneMiddlewares, project.getOne)
projectsRouter.delete('/:id', deleteMiddlewares, project.delete)

// ===== Роуты схемы полей проекта =====
projectsRouter.get(
    '/:projectId/scheme',
    getSchemeMiddlewares,
    projectField.getScheme
)
projectsRouter.post(
    '/:projectId/scheme',
    createFieldMiddlewares,
    projectField.createField
)
projectsRouter.put(
    '/:projectId/scheme/:fieldId',
    updateFieldMiddlewares,
    projectField.updateField
)
projectsRouter.delete(
    '/:projectId/scheme/:fieldId',
    deleteFieldMiddlewares,
    projectField.deleteField
)

// ===== Роуты шаблонов печати проекта =====
projectsRouter.get(
    '/:projectId/print-template',
    getProjectTemplateMiddlewares,
    printTemplateService.getByProject
)
projectsRouter.post(
    '/:projectId/print-template',
    assignTemplateMiddlewares,
    printTemplateService.assignToProject
)
projectsRouter.delete(
    '/:projectId/print-template',
    removeTemplateMiddlewares,
    printTemplateService.removeFromProject
)

// ===== Роуты webhooks проекта =====
projectsRouter.get(
    '/:projectId/webhooks',
    getSchemeMiddlewares,
    webhookService.getByProject
)

// ===== Скрипты проекта (пре/постскрипт применяются ко всем видам регистрации) =====
projectsRouter.get(
    '/:projectId/scripts',
    getSchemeMiddlewares,
    projectScriptsService.get
)
projectsRouter.put(
    '/:projectId/scripts',
    getSchemeMiddlewares,
    requireAdminForRuntimeScriptUpdate,
    projectScriptsService.update
)
projectsRouter.post(
    '/:projectId/scripts/runtime/run',
    getSchemeMiddlewares,
    roleCheck(adminRoles),
    projectScriptsService.runRuntime
)

// ===== Поиск участника по коду =====
projectsRouter.get(
    '/:projectId/code/:code',
    findByCodeMiddlewares,
    participantCode.findByCode
)

// ===== Роуты логов участников (должны быть ДО роутов с :participantId) =====
projectsRouter.get(
    '/:projectId/participants/log/stats',
    getLogsMiddlewares,
    participantLogService.getStats
)
projectsRouter.get(
    '/:projectId/participants/log',
    getLogsMiddlewares,
    participantLogService.getAll
)
projectsRouter.get(
    '/:projectId/operator/:userId',
    getLogsMiddlewares,
    participantLogService.getOperatorStats
)

// ===== Excel и массовые операции (должны быть ДО роутов с :participantId) =====
projectsRouter.get(
    '/:projectId/participants/excel',
    excelTemplateMiddlewares,
    participant.getExcelTemplate
)
projectsRouter.post(
    '/:projectId/participants/excel',
    excelImportMiddlewares,
    participant.importFromExcel
)
projectsRouter.get(
    '/:projectId/participants/export',
    excelExportMiddlewares,
    participant.exportToExcel
)
projectsRouter.delete(
    '/:projectId/participants',
    clearParticipantsMiddlewares,
    participant.clearAll
)

// ===== Очистка отметок печати и логов сканеров =====
projectsRouter.delete(
    '/:projectId/prints',
    clearPrintMarksMiddlewares,
    participantLogService.clearPrintMarks
)
projectsRouter.delete(
    '/:projectId/scanners/logs',
    clearScannerLogsMiddlewares,
    participantLogService.clearScannerLogs
)

// ===== Получение списка устройств проекта =====
//FIXME: вынести логику
projectsRouter.get(
    '/:projectId/devices',
    getSchemeMiddlewares,
    async (req: Request, res: Response) => {
        const projectId = Number(req.params.projectId)

        const [scanners, err] = await wrap(
            scannersDAL.getByProjectIdWithZones(projectId)
        )

        if (err) {
            return dbError(res, '#GETDEVICES1')
        }

        res.json(
            (scanners || []).map((s) => ({
                ...ScannerHelper.toJSON(s),
                zoneName: s.zoneName,
            }))
        )
    }
)

projectsRouter.post(
    '/:projectId/scans/excel',
    exportScansMiddlewares,
    scanExportService.exportScansToExcel.bind(scanExportService)
)
projectsRouter.post(
    '/:projectId/scanners/logs/mass',
    exportMassScansMiddlewares,
    scanExportService.exportMassScansToExcel.bind(scanExportService)
)

// ===== Роуты участников проекта =====
projectsRouter.get(
    '/:projectId/participants',
    getParticipantsMiddlewares,
    participant.getAll
)
projectsRouter.post(
    '/:projectId/participants/bulk-delete',
    deleteParticipantsBulkMiddlewares,
    participant.deleteMany
)
projectsRouter.get(
    '/:projectId/participants/:participantId',
    getParticipantMiddlewares,
    participant.getOne
)
projectsRouter.get(
    '/:projectId/participants/:participantId/log',
    getParticipantMiddlewares,
    participantLogService.getByParticipant
)
projectsRouter.get(
    '/:projectId/participants/:participantId/printCount',
    getParticipantMiddlewares,
    participantLogService.getParticipantPrintCount
)
projectsRouter.post(
    '/:projectId/participants',
    createParticipantMiddlewares,
    participant.create
)
projectsRouter.post(
    '/:projectId/participants/:participantId/print',
    printParticipantMiddlewares,
    participant.print
)
projectsRouter.put(
    '/:projectId/participants/:participantId',
    updateParticipantMiddlewares,
    participant.update
)
projectsRouter.delete(
    '/:projectId/participants/:participantId',
    deleteParticipantMiddlewares,
    participant.delete
)

// ===== Роуты журнала устройств =====
projectsRouter.get(
    '/:projectId/journal',
    getJournalMiddlewares,
    deviceJournalService.getAll
)
projectsRouter.get(
    '/:projectId/journal/stats',
    getJournalStatsMiddlewares,
    deviceJournalService.getStats
)
projectsRouter.post(
    '/:projectId/journal/:recordId/return',
    returnJournalMiddlewares,
    deviceJournalService.manualReturn
)
