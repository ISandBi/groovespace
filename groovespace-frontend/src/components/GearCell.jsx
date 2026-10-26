import { FaCheckCircle, FaRegCircle } from 'react-icons/fa';

export default function GearCell({ item, onToggle }) {
  return (
    <div 
      className={`gear-matrix-cell ${item.selected ? 'active' : ''}`}
      onClick={() => onToggle(item.id)}
    >
      <div className="gear-matrix-header">
        <p className="gear-matrix-name">{item.name}</p>
        <div style={{ color: item.selected ? 'var(--color-brand-primary)' : 'var(--color-border-default)' }}>
          {item.selected ? <FaCheckCircle size={18} /> : <FaRegCircle size={18} />}
        </div>
      </div>
      <p className="gear-matrix-price">\${item.price} <span>/ hr</span></p>
    </div>
  );
}
