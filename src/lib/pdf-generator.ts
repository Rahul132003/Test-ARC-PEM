import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, Category, BudgetSummaryData } from '@/types';

export function exportToPdf(project: Project, categories: Category[], summary: BudgetSummaryData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header background
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PROJECT BUDGET ESTIMATE', margin, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${project.name}${project.plot_no ? ` | ${project.plot_no}` : ''}`, margin, 28);
  doc.text(`Client: ${project.client}${project.location ? ` | ${project.location}` : ''}`, margin, 34);

  // Date on the right
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - margin, 20, { align: 'right' });
  if (project.area_sqft > 0) {
    doc.text(`Area: ${project.area_sqft.toLocaleString('en-IN')} sq.ft`, pageWidth - margin, 28, { align: 'right' });
  }

  let currentY = 55;

  // Summary Box
  doc.setTextColor(30, 30, 30);
  doc.setFillColor(245, 246, 250);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 3, 3, 'F');

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const summaryLabels = ['Subtotal', `Contingency (${project.contingency_rate}%)`, `GST (${project.gst_rate}%)`, 'Grand Total'];
  const summaryValues = [
    `Rs.${summary.subtotal.toLocaleString('en-IN')}`,
    `Rs.${summary.contingency.toLocaleString('en-IN')}`,
    `Rs.${summary.gst.toLocaleString('en-IN')}`,
    `Rs.${summary.grandTotal.toLocaleString('en-IN')}`,
  ];

  const colWidth = (pageWidth - margin * 2) / 4;
  summaryLabels.forEach((label, i) => {
    const x = margin + colWidth * i + colWidth / 2;
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(label, x, currentY + 8, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(summaryValues[i], x, currentY + 17, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });

  currentY += 32;

  // Rate per sq.ft
  if (project.area_sqft > 0) {
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rate per Sq.ft: Rs.${Math.round(summary.ratePerSqFt).toLocaleString('en-IN')}`, margin, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 8;
  }

  // Categories and items
  categories.forEach((category) => {
    const catTotal = (category.items || []).reduce((sum, item) => sum + item.quantity * item.rate, 0);

    if (currentY > 260) {
      doc.addPage();
      currentY = 20;
    }

    // Category header
    doc.setFillColor(
      parseInt(category.color.slice(1, 3), 16),
      parseInt(category.color.slice(3, 5), 16),
      parseInt(category.color.slice(5, 7), 16)
    );
    doc.rect(margin, currentY, 3, 6, 'F');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(category.name, margin + 6, currentY + 5);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Rs.${catTotal.toLocaleString('en-IN')}`, pageWidth - margin, currentY + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    currentY += 10;

    if ((category.items || []).length > 0) {
      const tableData = (category.items || []).map((item) => [
        item.description || '—',
        item.unit,
        item.quantity.toLocaleString('en-IN'),
        `Rs.${item.rate.toLocaleString('en-IN')}`,
        `Rs.${(item.quantity * item.rate).toLocaleString('en-IN')}`,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Description', 'Unit', 'Qty', 'Rate', 'Amount']],
        body: tableData,
        theme: 'plain',
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [70, 70, 70],
        },
        headStyles: {
          fillColor: [245, 246, 250],
          textColor: [100, 100, 100],
          fontStyle: 'bold',
          fontSize: 7,
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 18, halign: 'right' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    } else {
      currentY += 4;
    }
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(
      `Arch Budget Calculator • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Budget_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
