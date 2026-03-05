import logging

from fastapi import APIRouter, HTTPException, Query

from services.vnstock_client import VnstockClient

logger = logging.getLogger(__name__)

router = APIRouter()
client = VnstockClient()

# Static fallback for when VCI is down — top stocks from HOSE/HNX
_FALLBACK_SYMBOLS = [
    {"symbol": "VCB", "organ_name": "Ngân hàng TMCP Ngoại Thương Việt Nam", "exchange": "HOSE"},
    {"symbol": "FPT", "organ_name": "CTCP FPT", "exchange": "HOSE"},
    {"symbol": "VNM", "organ_name": "CTCP Sữa Việt Nam", "exchange": "HOSE"},
    {"symbol": "HPG", "organ_name": "CTCP Tập đoàn Hòa Phát", "exchange": "HOSE"},
    {"symbol": "MWG", "organ_name": "CTCP Đầu tư Thế Giới Di Động", "exchange": "HOSE"},
    {"symbol": "TCB", "organ_name": "Ngân hàng TMCP Kỹ Thương Việt Nam", "exchange": "HOSE"},
    {"symbol": "VHM", "organ_name": "CTCP Vinhomes", "exchange": "HOSE"},
    {"symbol": "MSN", "organ_name": "CTCP Tập đoàn Masan", "exchange": "HOSE"},
    {"symbol": "ACB", "organ_name": "Ngân hàng TMCP Á Châu", "exchange": "HOSE"},
    {"symbol": "VIC", "organ_name": "Tập đoàn Vingroup", "exchange": "HOSE"},
    {"symbol": "BID", "organ_name": "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", "exchange": "HOSE"},
    {"symbol": "CTG", "organ_name": "Ngân hàng TMCP Công Thương Việt Nam", "exchange": "HOSE"},
    {"symbol": "GAS", "organ_name": "Tổng Công ty Khí Việt Nam", "exchange": "HOSE"},
    {"symbol": "SAB", "organ_name": "Tổng CTCP Bia - Rượu - Nước Giải Khát Sài Gòn", "exchange": "HOSE"},
    {"symbol": "SSI", "organ_name": "CTCP Chứng khoán SSI", "exchange": "HOSE"},
    {"symbol": "VPB", "organ_name": "Ngân hàng TMCP Việt Nam Thịnh Vượng", "exchange": "HOSE"},
    {"symbol": "STB", "organ_name": "Ngân hàng TMCP Sài Gòn Thương Tín", "exchange": "HOSE"},
    {"symbol": "HDB", "organ_name": "Ngân hàng TMCP Phát triển TP.HCM", "exchange": "HOSE"},
    {"symbol": "MBB", "organ_name": "Ngân hàng TMCP Quân Đội", "exchange": "HOSE"},
    {"symbol": "TPB", "organ_name": "Ngân hàng TMCP Tiên Phong", "exchange": "HOSE"},
    {"symbol": "KDH", "organ_name": "CTCP Đầu tư Kinh Doanh Nhà Khang Điền", "exchange": "HOSE"},
    {"symbol": "VRE", "organ_name": "CTCP Vincom Retail", "exchange": "HOSE"},
    {"symbol": "DGC", "organ_name": "CTCP Tập đoàn Hóa chất Đức Giang", "exchange": "HOSE"},
    {"symbol": "NVL", "organ_name": "CTCP Tập đoàn Đầu tư Địa ốc No Va", "exchange": "HOSE"},
    {"symbol": "REE", "organ_name": "CTCP Cơ Điện Lạnh", "exchange": "HOSE"},
    {"symbol": "GVR", "organ_name": "Tập đoàn Công nghiệp Cao su Việt Nam", "exchange": "HOSE"},
    {"symbol": "PLX", "organ_name": "Tập đoàn Xăng Dầu Việt Nam", "exchange": "HOSE"},
    {"symbol": "PNJ", "organ_name": "CTCP Vàng Bạc Đá quý Phú Nhuận", "exchange": "HOSE"},
    {"symbol": "VJC", "organ_name": "CTCP Hàng không Vietjet", "exchange": "HOSE"},
    {"symbol": "HSG", "organ_name": "CTCP Tập đoàn Hoa Sen", "exchange": "HOSE"},
    {"symbol": "GMD", "organ_name": "CTCP Gemadept", "exchange": "HOSE"},
    {"symbol": "GEX", "organ_name": "CTCP Tập đoàn GELEX", "exchange": "HOSE"},
    {"symbol": "VND", "organ_name": "CTCP Chứng khoán VNDirect", "exchange": "HOSE"},
    {"symbol": "SHB", "organ_name": "Ngân hàng TMCP Sài Gòn - Hà Nội", "exchange": "HOSE"},
    {"symbol": "EIB", "organ_name": "Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam", "exchange": "HOSE"},
    {"symbol": "VIB", "organ_name": "Ngân hàng TMCP Quốc Tế Việt Nam", "exchange": "HOSE"},
    {"symbol": "HDG", "organ_name": "CTCP Tập đoàn Hà Đô", "exchange": "HOSE"},
    {"symbol": "PC1", "organ_name": "CTCP Tập đoàn PC1", "exchange": "HOSE"},
    {"symbol": "KBC", "organ_name": "Tổng Công ty Phát triển Đô thị Kinh Bắc", "exchange": "HOSE"},
    {"symbol": "DIG", "organ_name": "Tổng CTCP Đầu tư Phát triển Xây dựng", "exchange": "HOSE"},
]


@router.get("/symbols")
@router.get("/all-symbols")
async def get_all_symbols(
    exchange: str = Query(None, description="Filter by exchange: HOSE, HNX, UPCOM"),
):
    try:
        data = client.get_all_symbols(exchange)
        return {"count": len(data), "data": data}
    except Exception as e:
        logger.warning("VCI listing failed: %s, using fallback", e)
        fallback = _FALLBACK_SYMBOLS
        if exchange:
            fallback = [s for s in fallback if s["exchange"] == exchange.upper()]
        return {"count": len(fallback), "data": fallback, "source": "fallback"}


@router.get("/search")
async def search_symbol(
    q: str = Query(None, description="Search query (symbol or company name)"),
    query: str = Query(None, description="Alias for q"),
):
    search_term = q or query
    if not search_term:
        raise HTTPException(status_code=400, detail="Provide 'q' or 'query' parameter")
    try:
        data = client.search_symbol(search_term)
        return {"query": search_term, "data": data}
    except Exception as e:
        logger.warning("VCI search failed: %s, using fallback", e)
        term = search_term.lower()
        results = [
            s for s in _FALLBACK_SYMBOLS
            if term in s["symbol"].lower() or term in s["organ_name"].lower()
        ]
        return {"query": search_term, "data": results, "source": "fallback"}
