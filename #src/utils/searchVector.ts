import { Sequelize } from "sequelize";

export const searchVectorQuery = Sequelize.literal(
    `search_vector @@ plainto_tsquery('russian', :searchQuery)`
);

export function customVector({
    prefix = "",
    vectorName = "search_vector",
    lang = "russian",
}) {
    prefix = prefix.length? `"${prefix}".` : ""
    return Sequelize.literal(
        `${prefix}${vectorName} @@ plainto_tsquery('${lang}', :searchQuery)`
    );
}

export const searchVectorQueryRu = Sequelize.literal(
    `search_vector_ru @@ plainto_tsquery('russian', :searchQuery)`
);
export const searchVectorQueryEn = Sequelize.literal(
    `search_vector_en @@ plainto_tsquery('english', :searchQuery)`
);
