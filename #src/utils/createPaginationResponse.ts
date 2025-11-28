

export function createPaginationResponse(list: any[] | null, all: any[] | null, {limit, page}) {

    const total = all?.length || 1;
    return {
        records: list,
        page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        recordsPerPage: limit,
    }
}