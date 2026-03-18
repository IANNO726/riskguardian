from fastapi import APIRouter, Response
from datetime import datetime, timedelta
from app.services.mt5_wrapper import get_mt5\nmt5 = get_mt5()
from io import BytesIO
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# You'll need to install reportlab
# pip install reportlab --break-system-packages

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


@router.get("/export")
async def export_trading_report():
    """Generate and download trading report as PDF"""
    
    try:
        # Get MT5 data
        account_info = mt5.account_info()
        if not account_info:
            account_info = type('obj', (object,), {
                'balance': 0,
                'equity': 0,
                'profit': 0,
                'login': 'N/A'
            })()
        
        # Get trade history
        date_to = datetime.now()
        date_from = date_to - timedelta(days=30)
        deals = mt5.history_deals_get(date_from, date_to)
        
        if deals is None:
            deals = []
        
        # Create PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title = Paragraph("<b>Risk Guardian Trading Report</b>", styles['Title'])
        elements.append(title)
        elements.append(Spacer(1, 12))
        
        # Date
        date_text = Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal'])
        elements.append(date_text)
        elements.append(Spacer(1, 24))
        
        # Account Summary
        account_title = Paragraph("<b>Account Summary</b>", styles['Heading2'])
        elements.append(account_title)
        elements.append(Spacer(1, 12))
        
        account_data = [
            ['Account', str(account_info.login)],
            ['Balance', f"${account_info.balance:.2f}"],
            ['Equity', f"${account_info.equity:.2f}"],
            ['Profit', f"${account_info.profit:.2f}"],
        ]
        
        account_table = Table(account_data, colWidths=[200, 200])
        account_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(account_table)
        elements.append(Spacer(1, 24))
        
        # Trade History
        trades_title = Paragraph("<b>Recent Trades (Last 30 Days)</b>", styles['Heading2'])
        elements.append(trades_title)
        elements.append(Spacer(1, 12))
        
        if len(deals) > 0:
            trade_data = [['Date', 'Symbol', 'Volume', 'Profit']]
            
            for deal in deals[:20]:  # Show last 20 trades
                if deal.entry == 1:  # Closing deals only
                    trade_data.append([
                        datetime.fromtimestamp(deal.time).strftime('%Y-%m-%d'),
                        deal.symbol,
                        f"{deal.volume:.2f}",
                        f"${deal.profit:.2f}"
                    ])
            
            trade_table = Table(trade_data, colWidths=[100, 100, 100, 100])
            trade_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            elements.append(trade_table)
        else:
            no_trades = Paragraph("No trades found in the last 30 days.", styles['Normal'])
            elements.append(no_trades)
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        logger.info("📊 Trading report generated successfully")
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=trading-report-{datetime.now().strftime('%Y%m%d')}.pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to generate report: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


