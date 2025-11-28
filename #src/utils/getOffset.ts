export function _offset(page?: any, limit?: any) {
    return (
        ((parseInt(page as string) || 1) - 1) *
        (parseInt(limit as string) || 20)
    );
}
