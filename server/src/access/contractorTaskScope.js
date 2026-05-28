/** Имя роли типа исполнителя задания для внешнего подрядчика (= `roles.name`, join по `tasks.role_id`). */
export const CONTRACTOR_TASK_ROLE_NAME = 'Внешний подрядчик';

/** Короткий алиас для проверки на стороне Node (без JOIN). */
export function isExternalContractorAccountRole(roleName) {
  return roleName === CONTRACTOR_TASK_ROLE_NAME;
}

/**
 * Фрагмент SQL: задача принадлежит «области» подрядчика по типу задания.
 * @param {'t'|'t2'} taskAlias алиас таблицы `tasks` во внешнем запросе
 */
export function sqlTaskHasContractorType(taskAlias) {
  const name = CONTRACTOR_TASK_ROLE_NAME.replace(/'/g, "''");
  return `EXISTS (
    SELECT 1 FROM roles r_contractor_scope
    WHERE r_contractor_scope.id = ${taskAlias}.role_id
      AND r_contractor_scope.name = '${name}'
  )`;
}
