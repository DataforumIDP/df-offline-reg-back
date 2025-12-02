export function paginationResponse({ list, all, limit, page}) {
    const total = typeof all === 'number' ? all : (all?.length || 1);
    limit = (parseInt(limit) || 20)
    return {
        records: list,
        page: page || 1,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        recordsPerPage: limit,
    };
}
