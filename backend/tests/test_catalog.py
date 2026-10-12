import asyncio

from routers.catalog import catalog


def test_catalog_uses_prosthesis_category_names():
    result = asyncio.run(catalog())

    assert all(
        product["group"] != "Denture" for product in result["materials"]
    )
    assert all(
        not product.get("subgroup", "").startswith("Denture")
        for product in result["materials"]
    )
